#### Features

`Order` data can be generic. `dataType` field defines format of that data.

LibOrderData defines function parse which parses data field (according to dataType) and converts any version of the data to the latest supported by contract. 
(see [LibOrder](LibOrder.md) `Order.data` field)


see contracts/LibOrderData.sol
Order data can be set either empty = 0xffffffff
or NFT_TRANSFER_FROM_CONTRACT

if its set to NFT_TRANSFER_FROM_CONTRACT
it can handle NFT token transfers from contracts/GhostAuction.sol to the buyer

