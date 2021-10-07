// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import "./ExchangeV2Core.sol";
import "./GhostMarketTransferManager.sol";
import "./GhostAuction.sol";

contract ExchangeV2 is ExchangeV2Core, GhostMarketTransferManager, GhostAuction {

    using LibTransfer for address;
    using SafeMathUpgradeable for uint256;


    /// All of the details of an auction's completion,
    event OrderFilledAuction(
        uint256 auctionId,
        address nftContractAddress,
        address winner,
        uint256 amount
    );
    
    /**
     * @dev initialize ExchangeV2
     *
     * @param _transferProxy address for proxy transfer contract that handles ERC721 & ERC1155 contracts
     * @param _erc20TransferProxy address for proxy transfer contract that handles ERC20 contracts
     * @param newProtocolFee address for protocol fee
     * @param newDefaultFeeReceiver address for protocol fee if fee by token type is not set (GhostMarketTransferManager.sol => function getFeeReceiver)
     * @param adminRecoveryAddress GhostAuction contract admin address
     */
    function __ExchangeV2_init(
        INftTransferProxy _transferProxy,
        IERC20TransferProxy _erc20TransferProxy,
        uint newProtocolFee,
        address newDefaultFeeReceiver,
        // GhostAuction init varibales
        address adminRecoveryAddress
    ) external initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();
        __TransferExecutor_init_unchained(_transferProxy, _erc20TransferProxy);
        __GhostMarketTransferManager_init_unchained(newProtocolFee, newDefaultFeeReceiver);
        __OrderValidator_init_unchained();
        __ReserveAuctionV3_init_unchained(adminRecoveryAddress);
    }
    /**
     * @dev end the auction by transfering the nft to the the winner and funds to the seller
     * delete the auction data from the contract storage
     */
    function endAuctionDoTransfer(        
        LibOrder.Order memory orderLeft, 
        LibOrder.Order memory orderRight,
        uint256 auctionId
        ) external payable
        nonReentrant
        whenNotPaused
        auctionComplete(auctionId) {
        address payable winner = auctions[auctionId].bidder;
        require(
            winner == msg.sender || auctions[auctionId].auctionSpecAddr[0] == msg.sender,
            "Auction can only be claimed by the address who created or won it"
        );
        uint256 amount = auctions[auctionId].amount;
        emit OrderFilledAuction(auctionId, auctions[auctionId].auctionSpecAddr[1], winner, amount);
        //matchAndTransferAuction(orderLeft, orderRight, amount);
        matchAndTransfer(orderLeft, orderRight, amount, address(this));
        deleteAuction(auctionId);
    }

        /// ============ Create Bid ============

    function createBid(uint256 auctionId, uint256 amount, bool useToken)
        external
        payable
        nonReentrant
        whenNotPaused
        auctionExists(auctionId)
    {
        /// Reverts if the auction is expired
        require(
            /// Auction is not expired if there's never been a bid, or if the
            /// current timestamp is smaller than the timestamp at which the auction ends.
            auctions[auctionId].firstBidTime == 0 ||
                block.timestamp < auctionEnds(auctionId),
            "AE"
        );
        /// auction should have started to create bids, 
        /// if auction startdate is smaller then or equals the block.timestamp it has started
        require(
            auctions[auctionId].startingAt <= block.timestamp,
            "ANS"
        );
        IERC20Upgradeable token;
        /// Validate that the user's expected bid value matches the AVAX deposit.
        if(useToken){
            token = IERC20Upgradeable(auctions[auctionId].auctionSpecAddr[2]);
            // We must check the balance that was actually transferred to the market,
            // as some tokens impose a transfer fee and would not actually transfer the
            // full amount to the market, resulting in locked funds for refunds & bid acceptance
            uint256 beforeBalance = token.balanceOf(address(this));            
            //auctionTransferToken(amount, auctions[auctionId].auctionSpecAddr[2], msg.sender, address(this));
            IERC20TransferProxy(proxies[LibAsset.ERC20_ASSET_CLASS]).erc20safeTransferFrom(IERC20Upgradeable(token), msg.sender, address(this), amount);

            uint256 afterBalance = token.balanceOf(address(this));
            amount = afterBalance.sub(beforeBalance);
        } else {
            require(amount == msg.value, "ADNEMV");
        }
        
        require(amount > 0, "AMGT0");
        if (auctions[auctionId].auctionType == LibExchangeAuction.AuctionTypes.Reserve || auctions[auctionId].auctionType == LibExchangeAuction.AuctionTypes.Classic) {
        /// Check if the current bid amount is 0.
            if (auctions[auctionId].amount == 0) {
                /// If so, it is the first bid.
                auctions[auctionId].firstBidTime = block.timestamp;
                /// for reserve auction
                if (auctions[auctionId].auctionType == LibExchangeAuction.AuctionTypes.Reserve) {
                    /// We only need to check if the bid matches reserve bid for the first bid,
                    /// since future checks will need to be higher than any previous bid.
                    require(
                        amount >= auctions[auctionId].reservePrice,
                        "MBRPOM"
                    );
                }
            } else {
                /// Check that the new bid is sufficiently higher than the previous bid, by
                /// the percentage defined as minBidIncrementPercentAuction.
                require(
                    amount >=
                        auctions[auctionId].amount.add(
                            /// Add minBidIncrementPercentAuction of the current bid to the current bid.
                            auctions[auctionId]
                            .amount
                            .mul(minBidIncrementPercentAuction)
                            .div(100)
                        ),
                    "NMB"
                );

                /// Refund the previous bidder.
                if(useToken){
                    token.transfer(address(auctions[auctionId].bidder), auctions[auctionId].amount);
                } else {
                    address(auctions[auctionId].bidder).transferEth(auctions[auctionId].amount);
                }
            }
        }
        if (auctions[auctionId].auctionType == LibExchangeAuction.AuctionTypes.Dutch) {
            /// only one bid allowed
            require(auctions[auctionId].firstBidTime == 0, "DACOHOB");
            uint256 price = LibExchangeAuction.getCurrentPrice(auctions[auctionId]);
            require(amount >= price, "MSGVGEP");
            auctions[auctionId].endingPrice = price;
            auctions[auctionId].firstBidTime = block.timestamp;
        }
        /// Update the current auction.
        auctions[auctionId].amount = amount;
        auctions[auctionId].bidder = payable(msg.sender);
        /// Compare the auction's end time with the current time plus the extension period,
        /// to see whether we're near the auctions end and should extend the auction.
        if (auctions[auctionId].extensionPeriod != 0 && auctions[auctionId].auctionType != LibExchangeAuction.AuctionTypes.Dutch) {
            if (auctionEnds(auctionId) < block.timestamp.add(auctions[auctionId].extensionPeriod)) {
                /// We add onto the duration whenever time increment is required, so
                /// that the auctionEnds at the current time plus the buffer.
                auctions[auctionId].duration += block
                .timestamp
                .add(auctions[auctionId].extensionPeriod)
                .sub(auctionEnds(auctionId));
            }
        }
        /// Emit the event that a bid has been made.
        emit OrderBid(
            auctionId,
            auctions[auctionId].auctionSpecAddr[1],
            auctions[auctionId].tokenId,
            msg.sender,
            amount
        );
    }



    uint256[50] private __gap;
}
