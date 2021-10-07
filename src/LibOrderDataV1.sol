// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import "./lib/LibPart.sol";

library LibOrderDataV1 {
    bytes4 constant public V1 = bytes4(keccak256("V1"));
    bytes4 constant public NFT_TRANSFER_FROM_CONTRACT = bytes4(keccak256("NFT_TRANSFER_FROM_CONTRACT"));

    struct DataV1 {
        LibPart.Part[] payouts;
        LibPart.Part[] originFees;
    }

    function decodeOrderDataV1(bytes memory data) internal pure returns (DataV1 memory orderData) {
        orderData = abi.decode(data, (DataV1));
    }
}
