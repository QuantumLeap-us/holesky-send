const sendForm = document.getElementById('send-form');
const sendButton = document.getElementById('send-button');
const outputDiv = document.getElementById('output');

sendButton.addEventListener('click', async () => {
  const privateKeys = document.getElementById('private-key').value.split('\n')
    .map(key => key.trim())
    .filter(key => key !== '');

const toAddresses = sendForm.elements['to-addresses'].value.split('\n')
    .map(address => address.trim())
    .filter(address => address !== '');
  
  if (privateKeys.length === 0) {
    outputDiv.textContent = 'Please enter at least one private key';
    return;
  }

  if (toAddresses.length === 0) {
    outputDiv.textContent = 'Please enter at least one recipient address';
    return;
  }

  let numTransactions = 0;
  let numErrors = 0;

  for (const privateKey of privateKeys) {
    try {
      const transaction = await sendTransaction(privateKey, toAddresses);
      numTransactions++;
      outputDiv.innerHTML += `Transaction #${numTransactions} sent from ${transaction.from} with hash: <a href="https://holesky.etherscan.io/tx/${transaction.transactionHash}" rel="noopener">${transaction.transactionHash}</a><br>`;
      outputDiv.innerHTML += `Sent ${transaction.value} ETH to ${transaction.to}<br><br>`;

    } catch (error) {
      numErrors++;
      outputDiv.textContent += `Error sending transaction from ${error.from} to ${error.to}: ${error.message}\n`;
    }
  }

  if (numErrors > 0) {
    outputDiv.textContent += `Failed to send ${numErrors} transaction${numErrors === 1 ? '' : 's'}\n`;
  }
});

async function sendTransaction(privateKey, toAddresses) {
  const web3 = new Web3(new Web3.providers.HttpProvider('https://eth-holesky.blastapi.io/a5a43e8d-7adc-4994-baab-809705e8ebd5'));
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const balance = await web3.eth.getBalance(account.address);

  // 获取当前基础费用
  const baseFee = await web3.eth.getMaxPriorityFeePerGas();

  // 设置gasPrice为基础费用加上一个小的优先费用
  const priorityFee = web3.utils.toWei('1.5', 'gwei'); // 设置优先费用为1.5 Gwei
  const gasPrice = web3.utils.toBN(baseFee).add(web3.utils.toBN(priorityFee));

  for (const toAddress of toAddresses) {
    const transaction = {
      from: account.address,
      to: toAddress,
      value: web3.utils.toHex(balance - gasPrice * 21000), // 保留gas费用
      gas: web3.utils.toHex(21000), // 设置gas限制
      gasPrice: gasPrice // 使用基础费用加上优先费用作为gasPrice
    };

    try {
      const gasEstimate = await web3.eth.estimateGas(transaction);
      transaction.gas = gasEstimate; // 使用估算的gas值

      // 检查账户余额是否足够支付gas费用
      const gasLimit = web3.utils.toBN(transaction.gas);
      const totalGasCost = gasLimit.mul(gasPrice);
      const accountBalance = web3.utils.toBN(balance);

      if (totalGasCost.gt(accountBalance)) {
        throw new Error('Insufficient balance to pay gas');
      }

      const signedTx = await account.signTransaction(transaction);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      console.log('Transaction successful:', receipt.transactionHash);
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw error;
    }
  }
}
