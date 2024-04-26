const sendForm = document.getElementById('send-form');
const sendButton = document.getElementById('send-button');
const outputDiv = document.getElementById('output');

// 连接到以太坊节点
const web3 = new Web3(new Web3.providers.HttpProvider('https://holesky.infura.io/v3/ec2b75ea5bd94c8ea15f405a65fbff4c'));

// 估算Gas函数
async function estimateGas(transaction) {
  const gasEstimate = await web3.eth.estimateGas(transaction);
  return Math.ceil(gasEstimate * 1.2); // 增加20%的Gas上限
}

// 发送批量交易函数
async function sendBatchTransactions(batchTransactions, privateKey) {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);

  try {
    const gasEstimates = await Promise.all(batchTransactions.map(estimateGas));
    const signedTransactions = await Promise.all(
      batchTransactions.map((tx, index) => {
        tx.gas = gasEstimates[index];
        return account.signTransaction(tx);
      })
    );

    const results = await Promise.all(
      signedTransactions.map(tx => web3.eth.sendSignedTransaction(tx.rawTransaction))
    );

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

async function sendTransactionsBatch(privateKey, toAddresses) {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const balance = await web3.eth.getBalance(account.address);

  const gasPrice = await web3.eth.getGasPrice();
  const transactions = [];

  const BATCH_SIZE = 10;
  const DELAY_MS = 500;

  let nonce = await web3.eth.getTransactionCount(account.address, 'pending');

  for (let i = 0; i < toAddresses.length; i += BATCH_SIZE) {
    const batchToAddresses = toAddresses.slice(i, i + BATCH_SIZE);
    const batchTransactions = batchToAddresses.map(toAddress => ({
      from: account.address,
      to: toAddress,
      value: web3.utils.toHex(balance),
      gasPrice: web3.utils.toHex(gasPrice),
      nonce: web3.utils.toHex(nonce++)
    }));

    try {
      const batchTransactionResults = await sendBatchTransactions(batchTransactions, privateKey);
      transactions.push(...batchTransactionResults);
    } catch (error) {
      console.error('Error sending transactions:', error);
      outputDiv.textContent += `Error sending transactions from ${account.address}: ${error.message}\n`;
    }

    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }

  return transactions;
}

sendButton.addEventListener('click', async () => {
  const privateKey = document.getElementById('private-key').value.trim();
  const toAddresses = sendForm.elements['to-addresses'].value
    .split('\n')
    .map(address => address.trim())
    .filter(web3.utils.isAddress);

  if (!privateKey) {
    outputDiv.textContent = 'Please enter a private key';
    return;
  }

  if (toAddresses.length === 0) {
    outputDiv.textContent = 'Please enter at least one valid recipient address';
    return;
  }

  outputDiv.textContent = '';

  try {
    const transactions = await sendTransactionsBatch(privateKey, toAddresses);
    transactions.forEach(({ transactionHash, from, to, value }) => {
      outputDiv.innerHTML += `Transaction sent from ${from} with hash: <a href="https://etherscan.io/tx/${transactionHash}" target="_blank" rel="noopener">${transactionHash}</a><br>`;
      outputDiv.innerHTML += `Sent ${value} ETH to ${to}<br><br>`;
    });
  } catch (error) {
    outputDiv.textContent = `Error: ${error.message}`;
  }
});
