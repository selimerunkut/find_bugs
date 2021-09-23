/// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.4;

import {SafeMathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";


library LibExchangeAuction {
    using SafeMathUpgradeable for uint256;

    enum AuctionTypes {
        Other,
        Classic,
        Reserve,
        Dutch
    }

    /// ============ Structs ============

    struct Auction {
        /// The value of the current highest bid.
        uint256 amount;
        /// The amount of time that the auction should run for,
        /// after the first bid was made.
        uint256 duration;
        /// The time of the first bid.
        uint256 firstBidTime;
        /// The minimum price of the first bid.
        uint256 reservePrice;
        /// The address of the current highest bid.
        address payable bidder;
        /// TokenId of the NFT contract
        uint256 tokenId;
        /// Type of the auction
        AuctionTypes auctionType;
        /// starting block.timestamp of the auction
        uint256 startingAt;
        /// starting price of the auction
        uint256 startingPrice;
        /// ending price of the auction
        uint256 endingPrice;
        /// extension period of the auction
        uint256 extensionPeriod;
        /**
        * in order to prevent too many local variables resulting in "Stack too deep" error 
        * auction addresses are put into an array
        * 0: creator, 1: nftContract, 2: currencyTokenContract
        * creator: address that created the auction
        * address of the NFT contract
        * currencyTokenContract: address of erc20 contract as payment currency
        */
        address[3] auctionSpecAddr;
        /// token amount for erc1155
        uint8 erc1155TokenAmount;
    }
    
    /**
     * @dev calculate the current price for the dutch auction
     * 
     * timeSinceStart = block.timestamp - auction.startingAt
     * priceDiff = auction.startingPrice - auction.endingPrice
     * currentPrice = auction.startingPrice - (timeSinceStart * (priceDiff / auction.duration))
     */
    function getCurrentPrice(LibExchangeAuction.Auction memory auction) public view returns (uint256) {
      require(auction.startingAt > 0);

      ///  if seconds passed (= block.timestamp - auction.startingAt) is greater then auction duration
      if (block.timestamp - auction.startingAt >= auction.duration) {
          return auction.endingPrice;
      } else {
        uint256 currentPrice = auction.startingPrice.sub((block.timestamp.sub(auction.startingAt))
            .mul((auction.startingPrice.sub(auction.endingPrice))
            .div(auction.duration))
        );
        if (currentPrice < auction.endingPrice)
        {
            currentPrice = auction.endingPrice;
        }
        return currentPrice;
      }
    }
}
