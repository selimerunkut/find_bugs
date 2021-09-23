// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;



import "./OrderValidator.sol";
import "./AssetMatcher.sol";

import "./ITransferManager.sol";


abstract contract ExchangeV2Core is Initializable, OwnableUpgradeable, AssetMatcher, TransferExecutor, OrderValidator, ITransferManager {
    using SafeMathUpgradeable for uint;
    using LibTransfer for address;

    uint256 private constant UINT256_MAX = 2 ** 256 - 1;

    //state of the orders
    mapping(bytes32 => uint) public fills;

    //events
    event OrderFilled(bytes32 leftHash, bytes32 rightHash, address leftMaker, address rightMaker, uint newLeftFill, uint newRightFill);

    function matchOrders(
        LibOrder.Order memory orderLeft,
        bytes memory signatureLeft,
        LibOrder.Order memory orderRight,
        bytes memory signatureRight
    ) external payable {
        validateFull(orderLeft, signatureLeft);
        validateFull(orderRight, signatureRight);
        if (orderLeft.taker != address(0)) {
            require(orderRight.maker == orderLeft.taker, "leftOrder.taker verification failed");
        }
        if (orderRight.taker != address(0)) {
            require(orderRight.taker == orderLeft.maker, "rightOrder.taker verification failed");
        }

        matchAndTransfer(orderLeft, orderRight, msg.value, _msgSender());
    }

    function matchAndTransfer(LibOrder.Order memory orderLeft, LibOrder.Order memory orderRight, uint256 amount, address user) internal {
        (LibAsset.AssetType memory makeMatch, LibAsset.AssetType memory takeMatch) = matchAssets(orderLeft, orderRight);
        bytes32 leftOrderKeyHash = LibOrder.hashKey(orderLeft);
        bytes32 rightOrderKeyHash = LibOrder.hashKey(orderRight);
        LibFill.FillResult memory fill = LibFill.fillOrder(orderLeft, orderRight, fills[leftOrderKeyHash], fills[rightOrderKeyHash]);
        require(fill.takeValue > 0, "nothing to fill");
        (uint totalMakeValue, uint totalTakeValue) = doTransfers(makeMatch, takeMatch, fill, orderLeft, orderRight);
        if (makeMatch.assetClass == LibAsset.ETH_ASSET_CLASS) {
            require(amount >= totalMakeValue, "not enough AVAX");
            if (amount > totalMakeValue) {
                address(msg.sender).transferEth(amount - totalMakeValue);
            }
        } else if (takeMatch.assetClass == LibAsset.ETH_ASSET_CLASS) {
            require(amount >= totalTakeValue, "not enough AVAX");
            if (amount > totalTakeValue) {
                address(msg.sender).transferEth(amount - totalTakeValue);
            }
        }

        //address msgSender = _msgSender();
        if (user != orderLeft.maker) {
            fills[leftOrderKeyHash] = fills[leftOrderKeyHash] + fill.takeValue;
        }
        if (user != orderRight.maker) {
            fills[rightOrderKeyHash] = fills[rightOrderKeyHash] + fill.makeValue;
        }
        emit OrderFilled(leftOrderKeyHash, rightOrderKeyHash, orderLeft.maker, orderRight.maker, fill.takeValue, fill.makeValue);

    }

    function matchAssets(LibOrder.Order memory orderLeft, LibOrder.Order memory orderRight) internal view returns (LibAsset.AssetType memory makeMatch, LibAsset.AssetType memory takeMatch) {
        makeMatch = matchAssets(orderLeft.makeAsset.assetType, orderRight.takeAsset.assetType);
        takeMatch = matchAssets(orderLeft.takeAsset.assetType, orderRight.makeAsset.assetType);
        require(makeMatch.assetClass != 0 || takeMatch.assetClass != 0, "ADM");
    }

    function validateFull(LibOrder.Order memory order, bytes memory signature) internal view {
        LibOrder.validate(order);
        validate(order, signature);
    }

    uint256[49] private __gap;
}
