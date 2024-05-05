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

  outputDiv.textContent = '';

  let numTransactions = 0;
  let numErrors = 0;

  for (const privateKey of privateKeys) {
    try {
      const transactions = await sendTransactions(privateKey, toAddresses);
      numTransactions += transactions.length;
      transactions.forEach(({ transactionHash, from, to, value }, index) => {
        outputDiv.innerHTML += `Transaction #${numTransactions - transactions.length + index + 1} sent from ${from} with hash: <a href="https://holesky.etherscan.io/tx/${transactionHash}" rel="noopener" target="_blank">${transactionHash}</a><br>`;
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

async function sendTransactions(privateKey, toAddresses) {
  const web3 = new Web3(new Web3.providers.HttpProvider('https://holesky.infura.io/v3/ec2b75ea5bd94c8ea15f405a65fbff4c'));
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const balance = await web3.eth.getBalance(account.address);

  const currentGasPrice = await web3.eth.getGasPrice();
  const priorityFee = web3.utils.toWei('1.5', 'gwei');
  const gasPrice = web3.utils.toBN(currentGasPrice).add(web3.utils.toBN(priorityFee));

  const transactions = [];

  for (const toAddress of toAddresses) {
    try {
      const receipt = await sendSingleTransaction(web3, account, toAddress, web3.utils.toWei('0.5', 'ether'), gasPrice, balance);
      transactions.push({
        transactionHash: receipt.transactionHash,
        from: account.address,
        to: toAddress,
        value: '0.5'
      });
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw { from: account.address, message: error.message };
    }
  }

  return transactions;
}

async function sendSingleTransaction(web3, account, toAddress, value, gasPrice, balance) {
  const txObject = {
    from: account.address,
    to: toAddress,
    value: web3.utils.toHex(value),
    gasPrice: gasPrice
  };

  const gas = await web3.eth.estimateGas(txObject);

  const transaction = {
    ...txObject,
    gas: gas
  };

  const gasLimit = web3.utils.toBN(transaction.gas);
  const totalGasCost = gasLimit.mul(gasPrice);
  const accountBalance = web3.utils.toBN(balance);

  if (totalGasCost.gt(accountBalance)) {
    throw new Error('Insufficient balance to pay gas');
  }

  const signedTx = await account.signTransaction(transaction);
  const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  console.log('Transaction successful:', receipt.transactionHash);
  return receipt;
}
