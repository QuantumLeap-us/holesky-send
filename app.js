const sendForm = document.getElementById('send-form');
const sendButton = document.getElementById('send-button');
const outputDiv = document.getElementById('output');

sendButton.addEventListener('click', async () => {
  const privateKeys = document.getElementById('private-key').value.split('\n')
    。map(key => key.trim())
    。filter(key => key !== '');
  const toAddresses = sendForm.elements['to-addresses'].value.split('\n')
    。map(address => address.trim())
    。filter(address => address !== '');

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

  // 获取当前gasPrice,并从Wei转换为Gwei
  const gasPrice = await web3.eth.getGasPrice();
  const gasPriceInGwei = web3.utils.fromWei(gasPrice, 'gwei');

  for (const toAddress of toAddresses) {
    const transaction = {
      from: account.address,
      to: toAddress,
      value: balance - 21000, // 保留一部分用于支付gas费用
      gas: web3.utils.toHex(21000), // 设置gas限制
      gasPrice: web3.utils.toHex(gasPriceInGwei * 1e9) // 将gasPrice从Gwei转换为Wei
    };

    try {
      const gasEstimate = await web3.eth.estimateGas(transaction);
      transaction.gas = gasEstimate; // 使用估算的gas值
      const signedTx = await account.signTransaction(transaction);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      console.log('Transaction successful:', receipt.transactionHash);
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw error;
    }
  }
}
