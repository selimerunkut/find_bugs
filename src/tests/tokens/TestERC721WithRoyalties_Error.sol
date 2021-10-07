// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import "./GhostmarketERC721.sol";

contract TestERC721WithRoyalties_Error is GhostMarketERC721 {
    function getRoyalties(uint256) override external pure returns (Royalty[] memory) {
        revert("getRoyalties failed");
    }
}
