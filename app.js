const sendForm = document.getElementById('send-form');
const sendButton = document.getElementById('send-button');
const outputDiv = document.getElementById('output');

sendButton.addEventListener('click', async () => {
  const privateKeys = document.getElementById('private-key').value.split('\\n')
    .map(key => key.trim())
    .filter(key => key !== '');

  const toAddresses = sendForm.elements['to-addresses'].value.split('\\n')
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
      const transactions = await sendTransactionsBatch(privateKey, toAddresses);
      numTransactions += transactions.length;
      transactions.forEach(({ transactionHash, from, to, value }, index) => {
        outputDiv.innerHTML += `Transaction #${numTransactions - transactions.length + index + 1} sent from ${from} with hash: <a href="https://holesky.etherscan.io/tx/${transactionHash}" rel="noopener">${transactionHash}</a><br>`;
        outputDiv.innerHTML += `Sent ${value} ETH to ${to}<br><br>`;
      });
    } catch (error) {
      numErrors++;
      outputDiv.textContent += `Error sending transactions from ${error.from}: ${error.message}\n`;
    }
  }

  if (numErrors > 0) {
    outputDiv.textContent += `Failed to send ${numErrors} transaction${numErrors === 1 ? '' : 's'}\n`;
  }
});

async function sendTransactionsBatch(privateKey, toAddresses) {
  const web3 = new Web3(new Web3.providers.HttpProvider('https://holesky.infura.io/v3/ec2b75ea5bd94c8ea15f405a65fbff4c'));
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const balance = await web3.eth.getBalance(account.address);

  const currentGasPrice = await web3.eth.getGasPrice();
  const priorityFee = web3.utils.toWei('1.5', 'gwei');
  const gasPrice = web3.utils.toBN(currentGasPrice).add(web3.utils.toBN(priorityFee));

  const transactions = [];

  const BATCH_SIZE = 10; // 每批发送 10 个交易
  const DELAY_MS = 500; // 每批之间延迟 500 毫秒

  let nonce = await web3.eth.getTransactionCount(account.address, 'pending');

  for (let i = 0; i < toAddresses.length; i += BATCH_SIZE) {
    const batchToAddresses = toAddresses.slice(i, i + BATCH_SIZE);
    const batchTransactions = [];

    for (const toAddress of batchToAddresses) {
      const transaction = {
        from: account.address,
        to: toAddress,
        value: web3.utils.toHex(web3.utils.toWei('0.5', 'ether')),
        gas: web3.utils.toHex(21000),
        gasPrice: gasPrice,
        nonce: web3.utils.toHex(nonce)
      };

      batchTransactions.push(transaction);
      nonce++;
    }

    try {
      const batchTransactionResults = await sendBatchTransactions(batchTransactions);
      transactions.push(...batchTransactionResults);
    } catch (error) {
      console.error('Error sending transactions:', error);
      throw { from: account.address, message: error.message };
    }

    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }

  return transactions;
}

async function sendBatchTransactions(batchTransactions) {
  const web3 = new Web3(new Web3.providers.HttpProvider('https://ethereum-holesky.blockpi.network/v1/rpc/ce9f71735a4b346a47f062a8b55fdb4c355a13d1'));
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);

  try {
    const gasEstimates = await Promise.all(batchTransactions.map(tx => web3.eth.estimateGas(tx)));
    batchTransactions.forEach((tx, index) => {
      tx.gas = gasEstimates[index];
    });

    const signedTransactions = await Promise.all(batchTransactions.map(tx => account.signTransaction(tx)));
    const results = await Promise.all(signedTransactions.map(tx => web3.eth.sendSignedTransaction(tx.rawTransaction)));

    const batchTransactionResults = results.map((result, index) => {
      const transaction = batchTransactions[index];
      return {
        transactionHash: result.transactionHash,
        from: account.address,
        to: transaction.to,
        value: web3.utils.fromWei(transaction.value, 'ether')
      };
    });

    return batchTransactionResults;
  } catch (error) {
    console.error('Error sending batch transactions:', error);
    throw error;
  }
}
