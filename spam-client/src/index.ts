#!/usr/bin/env node
import fs from 'fs'
import { hideBin } from 'yargs/helpers'
import yargs from 'yargs/yargs'
import { Avalanche, BN, BinTools } from "avalanche";



let avax: Avalanche


const url = {
  hostname: 'localhost',
  protocol: 'http',
  networkID: 1337,
  port: 23090, //Replace with one of the node's port from the local network
  chainID: 'hYTyVk1DB1BPXF6HMSthmukqJNmwvRvnqeQEXPoBVNfURihqQ' //Replace with chainID of the local network
}

/**
 * Establish a connection to the network
 */
export async function establishConnection(): Promise<void> {
  avax = new Avalanche(
    url.hostname,
    url.port,
    url.protocol,
    url.networkID,
    url.chainID
  )

  const info = avax.Info()

  // console.log("Fetching network information...")

  const networkID = await info.getNetworkID()
  const networkPeers = await info.peers()
  console.log(`You are connected to chain ${networkID} with ${networkPeers.length + 1} nodes`);
}

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(true)
    }, ms)
  })
}

interface accountsOptions {
  number: number
}

const createAccounts = async (number: number) => {
  const xChain = avax.XChain()
  const keyChain = xChain.keyChain();
  let blockChainId = avax.XChain().getBlockchainID()
  const accounts = new Array(number)
    .fill(0)
    .map(() => {
      const key = keyChain.makeKey()
      let Xkey = key.getAddressString().replace(blockChainId, 'X')
      let requiredKeys = {
        pubkey: key.getPublicKeyString(),
        privKey: key.getPrivateKeyString(),
        address: Xkey
      }
      return requiredKeys
    })
  return accounts
}

yargs(hideBin(process.argv))
  .command(
    'accounts',
    'generate accounts --number [number]',
    () => { },
    async (argv: accountsOptions) => {
      await establishConnection()
      let accounts = await createAccounts(argv.number)
      let genesisKeys = []
      for (let i = 0; i < accounts.length; i++) {
        const entry = {
          "ethAddr": "0xb3d82b1367d362de99ab59a658165aff520cbd4d",
          "avaxAddr": accounts[i].address,
          "initialAmount": 100000000000000,
          "unlockSchedule": [
            {
              "amount": 100000000000000,
              "locktime": 1633824000
            }
          ]
        }
        genesisKeys.push(entry)
      }
      try {
        fs.writeFileSync('accounts.json', JSON.stringify(accounts, null, 0))
        console.log(
          `Wrote ${accounts.length} account${accounts.length > 1 ? 's' : ''
          } to accounts.json`
        )
        fs.writeFileSync('genesisKeys.json', JSON.stringify(genesisKeys, null, 2))
        console.log(
          `Wrote genesis required keys to genesisKeys.json`
        )
      } catch (error) {
        console.log(`Couldn't write accounts to file: ${error.message}`)
      }
    }
  )
  .option('number', {
    alias: 'n',
    type: 'number',
    description: 'number of accounts',
  }).argv

interface spamOptions {
  duration: number
  rate: number
  start: number
  end: number
}

yargs(hideBin(process.argv))
  .command(
    'spam',
    'spam nodes for [duration] seconds at [rate] tps',
    () => { },
    async (argv: spamOptions) => {
      await establishConnection()
      await spam(argv)
    }
  )
  .option('duration', {
    alias: 'd',
    type: 'number',
    description: 'The duration (in seconds) to spam the network',
  })
  .option('start', {
    alias: 's',
    type: 'number',
    description: 'the start index to use from the accounts',
  })
  .option('end', {
    alias: 'e',
    type: 'number',
    description: 'the end index to use from the accounts',
  })
  .option('rate', {
    alias: 'r',
    type: 'number',
    description: 'The rate (in tps) to spam the network at',
  }).argv


const spam = async (argv: spamOptions) => {
  let tps = argv.rate
  let duration = argv.duration
  let txCount = tps * duration
  let start = argv.start ? argv.start : 0
  let accounts
  try {
    accounts = JSON.parse(fs.readFileSync('accounts.json', 'utf8'))
    console.log(
      `Loaded ${accounts.length} account${accounts.length > 1 ? 's' : ''
      } from accounts.json`
    )
  } catch (error) {
    console.log(`Couldn't load accounts from file: ${error.message}`)
    return
  }
  let end = argv.end ? argv.end : accounts.length

  console.log(start, end)
  // shuffle(accounts)

  const xChain = avax.XChain()
  const blockChainID = xChain.getBlockchainID()

  xChain.setTxFee(new BN("1000000"))

  let txs = [];

  const asset = "AVAX" // Primary asset used for the transaction (Avalanche supports many)
  const binTools = BinTools.getInstance()

  const assetInfo = await xChain.getAssetDescription(asset)
  const assetID = binTools.cb58Encode(assetInfo.assetID)
  //amounts are in BN format
  let sendAmount = new BN("50000");

  for (let i = start; i < end; i++) {
    xChain.keyChain().importKey(accounts[i].privKey);
  }

  // console.log(await xChain.getBalance(accounts[0].address.replace('X', blockChainID), assetID))

  let k = start;
  for (let i = 0; i < txCount; i++) {
    try {
      // let random = getRandomInt(accounts.length);
      let random = getRandomArbitrary(start, end)
      // console.log(random)
      let sender = accounts[k].address.replace('X', blockChainID);
      // console.log(sender)
      let receiver = accounts[random].address.replace('X', blockChainID);
      // console.log(receiver)
      let { utxos } = await xChain.getUTXOs(sender)
      let unsignedTx = await xChain.buildBaseTx(utxos, sendAmount, assetID, [receiver], [sender], [sender]);
      let signedTx = unsignedTx.sign(xChain.keyChain())
      txs.push(signedTx)
      k++
    } catch (e) {
      console.log(i, e)
      break
    }
  }


  let Ichain = avax.Index();
  // let lastIndex = await Ichain.getLastAccepted();
  // console.log(await Ichain.getContainerByIndex(lastIndex.index))

  const waitTime = (1 / tps) * 1000
  let currentTime
  let sleepTime
  let elapsed
  let spamStartTime = Math.floor(Date.now() / 1000)
  let lastTime = Date.now()
  try {
    let LatestIndexBeforeSpamming: any = await Ichain.getLastAccepted();
    console.log('LatestIndexBeforeSpamming', LatestIndexBeforeSpamming.index)
  } catch (e) {
    console.log('LatestIndexBeforeSpamming', 0)
  }

  for (let i = 0; i < txCount; i++) {
    try {
      // console.log('Injected tx:', i + 1)
      // let txid = await xChain.issueTx(txs[i]);
      // console.log('txid', txid)
      xChain.issueTx(txs[i]);
    } catch (e) {
      console.log(e)
    }
    currentTime = Date.now()
    elapsed = currentTime - lastTime
    sleepTime = waitTime - elapsed
    if (sleepTime < 0) sleepTime = 0
    await sleep(sleepTime)
    lastTime = Date.now()
  }

  let spamEndTime = Math.floor(Date.now() / 1000)
  var timeDiff = spamEndTime - spamStartTime; //in ms
  // get seconds 
  var seconds = Math.round(timeDiff);

  try {
    let LatestIndexAfterSpamming: any = await Ichain.getLastAccepted();
    console.log('LatestIndexAfterSpamming', LatestIndexAfterSpamming.index)
  } catch (e) {
    console.log('LatestIndexAfterSpamming', 0)
  }
  console.log('totalSpammingTime', seconds)

}

// function getRandomInt(max) {
//   return Math.floor(Math.random() * max);
// }

function getRandomArbitrary(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}


// function shuffle(array) {
//   let currentIndex = array.length, randomIndex;

//   // While there remain elements to shuffle...
//   while (currentIndex != 0) {

//     // Pick a remaining element...
//     randomIndex = Math.floor(Math.random() * currentIndex);
//     currentIndex--;

//     // And swap it with the current element.
//     [array[currentIndex], array[randomIndex]] = [
//       array[randomIndex], array[currentIndex]];
//   }

//   return array;
// }


interface tpsOptions {
  startindex: string,
  output: string
}

yargs(hideBin(process.argv))
  .command(
    'check_tps',
    'get tps  --startblock [number] --txs [number]',
    () => { },
    async (argv: tpsOptions) => {
      await establishConnection()
      getTPS(argv).catch(console.error).finally(() => process.exit());
    }
  )
  .option('startindex', {
    alias: 's',
    type: 'string',
    description: 'end of block',
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'file to save the log',
  }).argv

const getTPS = async (argv: tpsOptions) => {
  let startIndex = argv.startindex
  let Ichain = avax.Index();
  let latestIndex = await Ichain.getLastAccepted();
  let endIndex = latestIndex.index
  let endTime = new Date(latestIndex.timestamp).getTime()
  let startIndexNumber = (parseInt(startIndex) + 1).toString()
  let startIndexInfo = await Ichain.getContainerByIndex(startIndexNumber)
  let startTime = new Date(startIndexInfo.timestamp).getTime()
  let totalTransactions = parseInt(endIndex) - parseInt(startIndex);
  let averageTime = (endTime - startTime) / 1000
  console.log('startIndex', startIndex, 'endBlock', endIndex)
  console.log(`total time`, averageTime)
  console.log(`total txs:`, totalTransactions)
  console.log(`avg tps`, totalTransactions / averageTime)
}
