const sendForm = document.getElementById('send-form');
const sendButton = document.getElementById('send-button');
const outputDiv = document.getElementById('output');

sendButton.addEventListener('click', async () => {
  const toAddresses = sendForm.elements['to-addresses'].value.split('\n')
  .map(address => address.trim())
  .filter(address => address !== '');

  if (privateKey === '') {
    outputDiv.textContent = 'Please enter a private key';
    return;
  }

  if (toAddresses.length === 0) {
    outputDiv.textContent = 'Please enter at least one recipient address';
    return;
  }

  let numTransactions = 0;
  let numErrors = 0;

  for (const toAddress of toAddresses) {
    try {
      const transaction = await sendTransaction(privateKey, toAddress);
      numTransactions++;
      outputDiv.innerHTML += `Transaction #${numTransactions} sent from ${transaction.from} with hash: <a href="https://holesky.etherscan.io/tx/${transaction.transactionHash}" rel="noopener">${transaction.transactionHash}</a><br>`;
      outputDiv.innerHTML += `Sent ${transaction.value} ETH to ${transaction.to}<br><br>`;

    } catch (error) {
      numErrors++;
      outputDiv.textContent += `Error sending transaction to ${error.to}: ${error.message}\n\n`;
    }
  }

  if (numErrors > 0) {
    outputDiv.textContent += `Failed to send ${numErrors} transaction${numErrors === 1 ? '' : 's'}\n`;
  }
});


async function sendTransaction(privateKey, toAddress) {
  const web3 = new Web3(new Web3.providers.HttpProvider('(https://holesky.infura.io/v3/ec2b75ea5bd94c8ea15f405a65fbff4c)'));
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const fromAddress = account.address;

  const balance = await web3.eth.getBalance(fromAddress);
  const value = web3.utils.toBN(balance).sub(web3.utils.toBN(web3.utils.toWei('0.00009', 'ether')));

  if (value <= 0) {
    throw new Error(`Insufficient balance in ${fromAddress}. Skipping transaction.`);
  }

  const gasPrice = await web3.eth.getGasPrice();
  const gasLimit = 21000;
  const txObject = {
    from: fromAddress,
    to: toAddress,
    value: web3.utils.toWei('0.01', 'ether'), // Send 0.01 ETH to each recipient
    gasPrice: gasPrice,
    gasLimit: gasLimit
  };

  const signed = await account.signTransaction(txObject);
  const tx = await web3.eth.sendSignedTransaction(signed.rawTransaction);
  return {
    from: fromAddress,
    to: toAddress,
    value: web3.utils.fromWei(txObject.value),
    transactionHash: tx.transactionHash
  };
}
