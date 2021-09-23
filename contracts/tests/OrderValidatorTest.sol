// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import "../../contracts/OrderValidator.sol";


contract OrderValidatorTest is OrderValidator {
    using ECDSAUpgradeable for bytes32;

    function __OrderValidatorTest_init() external initializer {
        __OrderValidator_init_unchained();
    }

    function validateOrderTest(
        LibOrder.Order calldata order,
        bytes calldata signature
    ) external view {
        return validate(order, signature);
    }

    function keccak256Result(bytes memory addr)
        external
        pure
        returns (bytes32)
    {
        bytes32 myHash = keccak256(addr);
        return myHash;
    }

    function hashTest(
        bytes32 intValue,
        bytes4 strValue,
        bytes memory addr
    ) external pure returns (bytes32) {
        bytes32 myHash =
            keccak256(abi.encode(intValue, strValue, keccak256(addr)));
        return myHash;
    }

    function hashOrder(LibOrder.Order memory order)
        public
        pure
        returns (bytes32)
    {
        bytes32 hash = LibOrder.hash(order);
        return hash;
    }

    function hashAssetType(LibAsset.AssetType calldata assetType)
        external
        pure
        returns (bytes32)
    {
        bytes32 hash = LibAsset.hash(assetType);
        return hash;
    }

    function hashAsset(LibAsset.Asset calldata asset)
        external
        pure
        returns (bytes32)
    {
        bytes32 hash = LibAsset.hash(asset);
        return hash;
    }

    function orderTypeHash() external pure returns (bytes32) {
        return LibOrder.ORDER_TYPEHASH;
    }

    function assetTypeHash() external pure returns (bytes32) {
        return LibAsset.ASSET_TYPEHASH;
    }

    function assetTypeTypeHash() external pure returns (bytes32) {
        return LibAsset.ASSET_TYPE_TYPEHASH;
    }

    function getHashTypedDataV4(bytes32 hash) public view returns (bytes32) {
        return _hashTypedDataV4(hash);
    }

    function recoverAddressFromSignature(
        LibOrder.Order memory order,
        bytes memory signature
    ) public view returns (address) {
        //bytes32 hash = LibOrder.hash(order);
        //hashOrder(order);
        return _hashTypedDataV4(hashOrder(order)).recover(signature);
        // return _hashTypedDataV4(hash).recover(signature);
    }

    function orderMakerEqualsOrderSigner(
        LibOrder.Order memory order,
        bytes memory signature
    ) public view {
        if (_msgSender() != order.maker) {
            bytes32 hash = LibOrder.hash(order);
            require(
                _hashTypedDataV4(hash).recover(signature) == order.maker,
                "order maker does not match order signer"
            );
        }
    }

    function recoverTest(
        bytes32 messageHash,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public pure returns (address) {
        return ecrecover(messageHash, v, r, s);
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
