## Avalanche TPS Test for Coin Transfer

##### Hardware: dedicated server at `nocix.net`

- Processor 2x E5-2660 @ 2.2GHz / 3GHz Turbo 16 Cores / 32 thread
- Ram 96 GB DDR3
- Disk 960 GB SSD
- Bandwidth 1Gbit Port: 200TB Transfer
- Operating System Ubuntu 18.04 (Bionic)

##### Network setup

- A network of 5 nodes was run.
- All nodes used the same IP, but different ports
- All nodes were participating for consensus; each was a block producer

##### Test setup for native coin transfer

- 50000 accounts were created for coin transfer
- 20000 native coin txs were submitted to the network as fast as possible
  - Each tx moved 1 Avax between two different randomly chosen accounts
  - The number of accounts was chosen to be equal to the number of total txs so that there would be a low chance of a tx getting rejected due to another transaction from the same account still pending.

##### Test result

- Tests are taken starting from 500 tps to 2000 tps for 5 to 10 seconds. Time between the first tx processed time of the spam and the last tx processed time was measured.
- (Spam rate* duration)*client = Total txs / Totat spam tps = Avg tps (time taken to process the txs)
  ```
  (  500 *  5 ) * 1 =  2500 txs /  500 tps => 625 ( 4s) , 586 (4s)
  (  500 *  5 ) * 3 =  4500 txs / 1500 tps => 514 (14s)
  (  700 *  5 ) * 1 =  3500 txs /  700 tps => 554 ( 6s)
  (  500 *  5 ) * 4 =  8000 txs / 2000 tps => 488 (20s)
  (  500 * 10 ) * 1 =  5000 txs /  500 tps => 514 (10s)
  (  500 * 20 ) * 1 = 10000 txs /  500 tps => 448 (22s)
  (  700 * 10 ) * 1 =  7000 txs /  700 tps => 365 (19s)
  (  700 * 20 ) * 1 = 14000 txs /  700 tps => 358 (39s)
  ( 1000 *  5 ) * 1 =  5000 txs / 1000 tps => 498 (10s) , 501 ( 9s) , 550 ( 9s)
  ( 1000 *  5 ) * 2 = 10000 txs / 2000 tps => 433 (23s) , 496 (20s) , 480 (20s)
  ```
- Estimated average tps is around **500 TPS**

##### Instructions to recreate this test

1.  Install required tools and dependencies.
    1. [https://docs.avax.network/build/tutorials/nodes-and-staking/run-avalanche-node#download-avalanchego](https://docs.avax.network/build/tutorials/nodes-and-staking/run-avalanche-node#download-avalanchego)
    2. [https://docs.avax.network/build/tutorials/platform/create-a-local-test-network#avalanche-network-runner](https://docs.avax.network/build/tutorials/platform/create-a-local-test-network#avalanche-network-runner)
    3. Since we will be using avalanche-network-runner to create our local network, we must move **avalanchego** repo to **$GOPATH/src/github.com/ava-labs/avalanchego**
2.  Create a 5 local nodes network.

    1.  First, we must start the default 5 nodes network using avalanche-network-runner

        1.  go run ./examples/local/fivenodenetwork/main.go
        2.  This will output the 5 nodes’ API Port which we will be using to connect to the node.

            e.g. API port 35513

        3.  Use this command to get the local blockChain Id

            ```
            curl -X POST --data '{
                  "jsonrpc":"2.0",
                  "id"     :1,
                  "method" :"info.getBlockchainID",
                  "params": {
                      "alias":"X"
                  }
              }' -H 'content-type:application/json;' 127.0.0.1:[port_number]/ext/info
            ```

            ```
            {"jsonrpc":"2.0","result":{"blockchainID":"hYTyVk1DB1BPXF6HMSthmukqJNmwvRvnqeQEXPoBVNfURihqQ"},"id":1}
            ```

        4.  Look into step 3(5) to create accounts keys. Then we will add these accounts to the genesis for some funds.

    2.  Edit the genesis file which is under avalanche-network-runner/local/default/genesis.json.
    3.  Add these accounts from spam-client/genesisKeys.json under _allocations_ field. eg.

        ```
         {
         "networkID": 1337,
         "allocations": [
           ...
           {
             "ethAddr": "0xb3d82b1367d362de99ab59a658165aff520cbd4d",
             "avaxAddr": "X-custom16045mxr3s2cjycqe2xfluk304xv3ezhkhsvkpr",
             "initialAmount": 10000000000000000,
             "unlockSchedule": [
               {
                 "amount": 10000000000000000,
                 "locktime": 1633824000
               }
             ]
           },
           … New Accounts
           {
             "ethAddr": "0xb3d82b1367d362de99ab59a658165aff520cbd4d",
             "avaxAddr": "X-custom1mxnjxh0dy82eur28verwz7zfdseffvnkm4elma",
             "initialAmount": 100000000000000,
             "unlockSchedule": [
               {
                 "amount": 100000000000000,
                 "locktime": 1633824000
               }
             ]
           },
        ```

    4.  Change the startTime value in the genesis.json also.

        ```
        "startTime": 1620987200
        ```

    5.  Now we can restart the network with these config.

        - go run ./examples/local/fivenodenetwork/main.go

    6.  Delete the network data.
        - cd /tmp && rm -fr avalanche* coreth* plugin\*

3.  Custom Scripts that are used for running transactions to the network.

    1.  [https://gitlab.com/shardeum/smart-contract-platform-comparison/avalanche](https://gitlab.com/shardeum/smart-contract-platform-comparison/avalanche)
    2.  _cd spam-client && npm install && npm link_
    3.  Replace the _port_ and _chainID_ variable in src/index.ts with the values from steps no. 2.1.2 and 2.1.3.
    4.  Compile the changes by running the commnad _npm run prepare_
    5.  To generate accounts that are to be added in the genesis.file before the network started.
        1. spammer accounts --number [number]
        2. This will create accounts.json andgenesisKeys.json files under the directory.
        3. See step no. 2(2) for additional steps
    6.  Spam the network with these accounts and check the average TPS in each spam with step 7.

        1. Make sure you have added the correct _port_ and _chainID _ in src/index.ts.
        2. Make sure you have run _npm run prepare_ before running

           - spammer spam --duration [number] --rate [number] --start [number] --end [number]

             --start (optional) is for the start index number of the accounts to use when spamming

             --end (optional) is for the end index number of the accounts to use when spamming

             e.g. To spam the network for 5 seconds with 10 tps

             spammer spam --duration 5 --rate 10 --start 0 --end 1000

        3. This will output the _lastestBlockBeforeSpamming_ in the log. Use this as _startindex_ to check the tps of the spam.

    7.  Check the average TPS of the spam

        - spammer check_tps --startindex [number]
          e.g. spammer check_tps --startindex 100
