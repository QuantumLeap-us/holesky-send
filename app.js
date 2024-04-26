const sendForm = document.getElementById('send-form');
const sendButton = document.getElementById('send-button');
const outputDiv = document.getElementById('output');

// 连接到以太坊节点
const web3 = new Web3(new Web3.providers.HttpProvider('https://ethereum-holesky.blockpi.network/v1/rpc/ce9f71735a4b346a47f062a8b55fdb4c355a13d1'));

// 估算Gas函数
async function estimateGas(transaction) {
  const gasEstimate = await web3.eth.estimateGas(transaction);
  return Math.ceil(gasEstimate * 1.2); // 增加20%的Gas上限
}

// 等待交易收据函数
async function waitForTransactionReceipt(transactionHash) {
  const checkInterval = 5000; // 检查间隔时间（5秒）
  const maxAttempts = 30; // 最大尝试次数（2.5分钟）
  let attempts = 0;

  while (attempts < maxAttempts) {
    const receipt = await web3.eth.getTransactionReceipt(transactionHash);
    if (receipt) {
      return receipt;
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    attempts++;
  }

  throw new Error(`Failed to get transaction receipt for ${transactionHash}`);
}

// 发送批量交易函数
async function sendBatchTransactions(batchTransactions, privateKey) {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const nonce = await web3.eth.getTransactionCount(account.address, 'pending');
  const gasPrice = await web3.eth.getGasPrice();

  try {
    const signedTransactions = await Promise.all(
      batchTransactions.map(async (tx, index) => {
        tx.gas = await estimateGas(tx);
        tx.gasPrice = gasPrice;
        tx.nonce = web3.utils.toHex(nonce + index);
        return account.signTransaction(tx);
      })
    );

    const results = await Promise.all(
      signedTransactions.map(async tx => {
        const result = await web3.eth.sendSignedTransaction(tx.rawTransaction);
        const receipt = await waitForTransactionReceipt(result.transactionHash);
        return receipt;
      })
    );

    const batchTransactionResults = results.map((receipt, index) => {
      const transaction = batchTransactions[index];
      return {
        transactionHash: receipt.transactionHash,
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
  const batchTransactions = toAddresses.map(toAddress => ({
    from: web3.eth.accounts.privateKeyToAccount(privateKey).address,
    to: toAddress,
    value: web3.utils.toHex(web3.utils.toWei('0.5', 'ether')),
  }));

  try {
    const batchTransactionResults = await sendBatchTransactions(batchTransactions, privateKey);
    batchTransactionResults.forEach(({ transactionHash, from, to, value }) => {
      outputDiv.innerHTML += `Transaction sent from ${from} with hash: <a href="https://etherscan.io/tx/${transactionHash}" target="_blank" rel="noopener">${transactionHash}</a><br>`;
      outputDiv.innerHTML += `Sent ${value} ETH to ${to}<br><br>`;
    });
  } catch (error) {
    console.error('Error sending transactions:', error);
    outputDiv.textContent += `Error sending transactions from ${web3.eth.accounts.privateKeyToAccount(privateKey).address}: ${error.message}\n`;
  }
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
    await sendTransactionsBatch(privateKey, toAddresses);
  } catch (error) {
    outputDiv.textContent = `Error: ${error.message}`;
  }
});
