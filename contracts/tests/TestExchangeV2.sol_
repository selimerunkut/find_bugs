// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import "../ExchangeV2.sol";
import "../ExchangeV2Core.sol";
import "../GhostMarketTransferManager.sol";
import "../GhostAuction.sol";

contract TestExchangeV2 is ExchangeV2 {
    function matchAndTransferExternal(
        LibOrder.Order memory orderLeft,
        LibOrder.Order memory orderRight,
        uint256 amount,
        address user
    ) public payable {
        matchAndTransfer(orderLeft, orderRight, amount, user);
    }

    function deleteAuctionExternal(uint256 auctionId) public {
        deleteAuction(auctionId);
    }

    uint256[50] private __gap;
}
