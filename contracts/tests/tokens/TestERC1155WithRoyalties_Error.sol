// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import "./GhostmarketERC1155.sol";

contract TestERC1155WithRoyalties_Error is GhostMarketERC1155 {

    function getRoyalties(uint256) override external pure returns (Royalty[] memory) {
        revert("getRoyalties failed");
    }
}

