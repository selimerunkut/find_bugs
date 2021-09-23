const { BigNumber } = require('ethers')
const { BN, ether } = require('@openzeppelin/test-helpers');
const { expect } = require('chai')

const TOKEN_NAME = "GhostMarket"
const TOKEN_SYMBOL = "GHOST"
const BASE_URI = "https://ghostmarket.io/"
const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"
const PAUSER_ROLE = "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a"
const POLYNETWORK_ROLE = "0x8a9d57248f1015d5cac20111fe2512477434cf493627e5e959ca751e593d8079"
const METADATA_JSON = '{"name":"My NFT Name","description":"My NFT Name","image":"ipfs://QmWpUHUKjcYbhqGtxHnH39F5tLepfztGQAcYtsnHtWfgjD","external_url":"extURI","attributes":[{"type":"AttrT1","value":"AttrV1","display":""},{"type":"AttrT2","value":"AttrV2","display":""}],"properties":{"has_locked":true,"creator":"0x9e1bd73820a607b06086b5b5173765a61ceee7dc","royalties":0,"type":2}}'

/**
 * returns the last minted token
 * interacts with the blockchain and needs to be async
 * 
 * @param {proxy contract} token 
 * @returns {BN} last minted token ID as Big Number
 */
async function getLastTokenID(token) {
  let counter = await token.getCurrentCounter()
  if (counter == 1) {
    return new BN(parseInt(counter));
  } else return new BN(parseInt(counter - 1));
}

const toTxHash = (value) => {
  if (typeof value === "string") {
    // this is probably a tx hash already
    return value;
  } else if (typeof value.receipt === "object") {
    // this is probably a tx object
    return value.receipt.transactionHash;
  } else {
    throw "Unsupported tx type: " + value;
  }
}

const mineTx = (promiseOrTx, interval) => {
  return Promise.resolve(promiseOrTx)
    .then(tx => {
      const txHash = toTxHash(tx);

      return new Promise((resolve, reject) => {
        const getReceipt = () => {
          web3.eth.getTransactionReceipt(txHash, (error, receipt) => {
            if (error) {
              reject(error);
            } else if (receipt) {
              resolve(receipt);
            } else {
              setTimeout(getReceipt, interval || 500);
            }
          })
        }

        getReceipt();
      })
    });
}

const advanceTime = (time) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [time],
      id: new Date().getTime()
    }, (err, result) => {
      if (err) { return reject(err) }
      return resolve(result)
    })
  })
}

const advanceBlock = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      id: new Date().getTime()
    }, (err, result) => {
      if (err) { return reject(err) }
      const newBlockHash = web3.eth.getBlock('latest').hash

      return resolve(newBlockHash)
    })
  })
}

const takeSnapshot = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_snapshot',
      id: new Date().getTime()
    }, (err, snapshotId) => {
      if (err) { return reject(err) }
      return resolve(snapshotId)
    })
  })
}

const revertToSnapShot = (id) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_revert',
      params: [id],
      id: new Date().getTime()
    }, (err, result) => {
      if (err) { return reject(err) }
      return resolve(result)
    })
  })
}

const advanceTimeAndBlock = async (time) => {
  await advanceTime(time)
  await advanceBlock()
  return Promise.resolve(web3.eth.getBlock('latest'))
}

async function getCurrentBlockTime(asDate = true) {
  blockNum = await web3.eth.getBlockNumber()
  block = await web3.eth.getBlock(blockNum)
  if (asDate) {
    const date = new Date(block['timestamp'] * 1000);
    //console.log("currentBlockTime: ", date.toLocaleString());
    return date
  } else {
    return block['timestamp']
  }
}

async function getGasAmountFromTx(receipt) {

  const gasUsed = receipt.receipt.gasUsed;

  // Obtain gasPrice from the transaction
  const tx = await web3.eth.getTransaction(receipt.tx);
  const gasPrice = tx.gasPrice;

  console.log("receipt: " + receipt);
  console.log("tx: " + tx);
  console.log("gasUsed: " + gasUsed);
  console.log("gasPrice: " + gasPrice);
  console.log("gasUsed * gasPrice: " + gasUsed * gasPrice);

  return gasUsed * gasPrice;
}

async function verifyBalanceChange(account, change, todo) {
  const BN = web3.utils.BN;
  let before = new BN(await web3.eth.getBalance(account));
  await todo();
  let after = new BN(await web3.eth.getBalance(account));
  let actual = before.sub(after);
  expect(actual).to.be.bignumber.equal(change.toString());
}

async function getEvents(contract, tx) {
  let receipt = await ethers.provider.getTransactionReceipt(tx.hash)
  return receipt.logs.reduce((parsedEvents, log) => {
    try {
      parsedEvents.push(contract.interface.parseLog(log))
    } catch (e) { }
    return parsedEvents
  }, [])
}

async function eventTesting(transactionResult, contract, eventName, eventsKeyValueObject) {
  let events = await getEvents(contract, transactionResult)
  if (events.length === 0) {
    throw "no events"
  }
  let event = events[0]
  expect(event.name).eq(eventName)
  for (const [key, value] of Object.entries(eventsKeyValueObject)) {
    expect((event.args[key]).toString()).eq(value.toString())
  }
}

function etherAmountAsBigNumberWD(etherAmount) {
  return BigNumber.from((ether(etherAmount.toString())).toString())
}

function expectEqualStringValues(value1, value2) {
  expect(value1.toString()).to.equal(value2.toString())
}

module.exports = {
  TOKEN_NAME,
  TOKEN_SYMBOL,
  BASE_URI,
  METADATA_JSON,
  POLYNETWORK_ROLE,
  getLastTokenID,
  mineTx,
  advanceTime,
  advanceBlock,
  advanceTimeAndBlock,
  takeSnapshot,
  revertToSnapShot,
  getCurrentBlockTime,
  verifyBalanceChange,
  getEvents,
  eventTesting,
  etherAmountAsBigNumberWD,
  expectEqualStringValues
}
