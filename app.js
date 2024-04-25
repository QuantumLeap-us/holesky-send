async function sendTransactionsBatch(privateKey, toAddresses) {
  const web3 = new Web3(new Web3.providers.HttpProvider('https://eth-holesky.blastapi.io/a5a43e8d-7adc-4994-baab-809705e8ebd5'));
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const balance = await web3.eth.getBalance(account.address);

  // 获取账户的未决交易
  const pendingTransactions = await web3.eth.getTransactionCount(account.address, 'pending');

  // 获取当前的gas价格
  const currentGasPrice = await web3.eth.getGasPrice();

  // 设置gasPrice为当前gas价格加上一个小的优先费用
  const priorityFee = web3.utils.toWei('1.5', 'gwei'); // 设置优先费用为1.5 Gwei
  const gasPrice = web3.utils.toBN(currentGasPrice).add(web3.utils.toBN(priorityFee));

  const transactions = [];
  const batchTransactions = [];

  for (const toAddress of toAddresses) {
    const transaction = {
      from: account.address,
      to: toAddress,
      value: web3.utils.toHex(web3.utils.toWei('0.5', 'ether')),
      gas: web3.utils.toHex(21000),
      gasPrice: gasPrice,
      nonce: pendingTransactions // 使用未决交易的数量作为nonce
    };

    batchTransactions.push(transaction);
    pendingTransactions++; // 增加nonce值,以防止后续交易也被视为替换交易
  }

  try {
    const gasEstimates = await Promise.all(batchTransactions.map(tx => web3.eth.estimateGas(tx)));
    batchTransactions.forEach((tx, index) => {
      tx.gas = gasEstimates[index];
    });

    const signedTransactions = await Promise.all(batchTransactions.map(tx => account.signTransaction(tx)));
    const results = await Promise.all(signedTransactions.map(tx => web3.eth.sendSignedTransaction(tx.rawTransaction)));

    results.forEach((result, index) => {
      const transaction = batchTransactions[index];
      transactions.push({
        transactionHash: result.transactionHash,
        from: account.address,
        to: transaction.to,
        value: web3.utils.fromWei(transaction.value, 'ether')
      });
    });
  } catch (error) {
    console.error('Error sending transactions:', error);
    throw { from: account.address, message: error.message };
  }

  return transactions;
}
