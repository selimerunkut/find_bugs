// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "../../src/GhostMarketTransferManager.sol";

import "../../src/OrderValidator.sol";

contract GhostMarketTransferManagerTest is GhostMarketTransferManager, TransferExecutor, OrderValidator, ERC1155HolderUpgradeable {

    function encode(LibOrderDataV1.DataV1 memory data) pure external returns (bytes memory) {
        return abi.encode(data);
    }

    function checkDoTransfers(
        LibAsset.AssetType memory makeMatch,
        LibAsset.AssetType memory takeMatch,
        LibFill.FillResult memory fill,
        LibOrder.Order memory leftOrder,
        LibOrder.Order memory rightOrder
    ) payable external {
        doTransfers(makeMatch, takeMatch, fill, leftOrder, rightOrder);
    }

    function __TransferManager_init(
        INftTransferProxy _transferProxy,
        IERC20TransferProxy _erc20TransferProxy,
        uint newProtocolFee,
        address newDefaultFeeReceiver
    ) external initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();
        __TransferExecutor_init_unchained(_transferProxy, _erc20TransferProxy);
        __GhostMarketTransferManager_init_unchained(newProtocolFee, newDefaultFeeReceiver);
        __OrderValidator_init_unchained();
    }
}
