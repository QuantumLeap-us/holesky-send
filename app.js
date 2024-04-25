
const sendForm = document.getElementById('send-form');
const sendButton = document.getElementById('send-button');
const outputDiv = document.getElementById('output');

sendButton.addEventListener('click', async () => {
  const privateKeys = [...]; // Get the array of private keys from the form input
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
      outputDiv.textContent += `Error sending transaction from ${error.from} to ${error.to}: ${error.message}\n\`;
    }
  }

  if (numErrors > 0) {
    outputDiv.textContent += `Failed to send ${numErrors} transactions${numErrors === 1 ? '' : 's'}\n`;
  }
});

async function sendTransaction(privateKey, toAddress) {
  const web3 = new Web3(new Web3.providers.HttpProvider('https://eth-holesky.blastapi.io/a5a43e8d-7adc-4994-baab-809705e8ebd5'));
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const transaction = {
    from: account.address,
    to: toAddress,
    value: '1.0', // Replace with the actual ETH amount
    gasPrice: '20.0',
    gasLimit: '20000'
  };

  try {
    await web3.eth.sendTransaction(transaction);

  } catch (error) {
    throw error;
  }
}
