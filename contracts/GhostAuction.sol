/// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;
pragma abicoder v2;

/// OpenZeppelin library for performing math operations without overflows.
import {SafeMathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
/// OpenZeppelin security library for preventing reentrancy attacks.
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
/// For checking `supportsInterface`.


import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";

import "./lib/LibTransfer.sol";
import "./lib/LibExchangeAuction.sol";

contract GhostAuction is Initializable, ReentrancyGuardUpgradeable, OwnableUpgradeable, ERC1155HolderUpgradeable 
{
    /// Use OpenZeppelin's SafeMath library to prevent overflows.
    using SafeMathUpgradeable for uint256;

    using CountersUpgradeable for CountersUpgradeable.Counter;

    using LibTransfer for address;

    /// _tokenIdTracker to generate automated token IDs
    CountersUpgradeable.Counter private _auctionId;

    /// ============ Constants ============

    /// The % of AVAX needed above the current bid for a new bid to be valid; 5%.
    uint8 public minBidIncrementPercentAuction;
    /// The min and max duration allowed for auctions; 10 minutes - 30 days.
    uint256 public minAuctionDuration;
    uint256 public maxAuctionDuration;
    /// Interface constant for ERC721, to check values in constructor.
    bytes4 private constant ERC721_INTERFACE_ID = 0x80ac58cd;
    /// Interface constant for ERC1155, to check values in constructor.
    bytes4 private constant ERC1155_INTERFACE_ID = 0xd9b67a26;

    /// ============ Immutable Storage ============

    /// The address that initially is able to recover assets.
    address internal adminRecoveryAddress;

    /// ============ Mutable Storage ============

    /**
     * @dev The account `adminRecoveryAddress` can also pause the contracts.
     * This prevents people from using the contract if there is a known problem with it.
     */
    bool private _paused;

    /// A mapping of all of the auctions currently running.
    mapping(uint256 => LibExchangeAuction.Auction) public auctions;


    /// ============ Events ============

    /// All of the details of a new auction,
    event OrderCreated(
        uint256 auctionId,
        uint256 tokenId,
        address nftContractAddress,
        uint256 duration,
        uint256 reservePrice,
        uint256 endPrice,
        LibExchangeAuction.AuctionTypes auctionType,
        uint256 startingAt,
        uint256 extensionPeriod,
        address[3] auctionSpecAddr,
        uint8 erc1155TokenAmount
    );

    /// All of the details of a new bid,
    event OrderBid(
        uint256 auctionId,
        address nftContractAddress,
        uint256 tokenId,
        address sender,
        uint256 value
    );

    /// All of the details of an auction's cancelation,
    event OrderCancelled(
        uint256 auctionId,
        address nftContractAddress,
        uint256 tokenId
    );

    /// Emitted in the case that the contract is paused.
    event Paused(address account);
    /// Emitted when the contract is unpaused.
    event Unpaused(address account);

    /// ============ Modifiers ============

    modifier onlyAdminRecovery() {
        require(
            /// The sender must be the admin address, and
            adminRecoveryAddress == msg.sender,
            "CDNHAP"
        );
        _;
    }

    /// Reverts if the contract is paused.
    modifier whenNotPaused() {
        require(!paused(), "CIP");
        _;
    }

    /// Reverts if the auction does not exist.
    modifier auctionExists(uint256 auctionId) {
        /// The auction exists if the nftContractAddress is not null.
        require(!auctionNftContractIsNull(auctionId), "ADE");
        _;
    }

    /// Reverts if the auction exists.
    modifier auctionNonExistant(uint256 auctionId) {
        /// The auction does not exist if the nftContractAddress is null.
        require(auctionNftContractIsNull(auctionId), "AAE");
        _;
    }

    /// Reverts if the auction is not complete.
    /// Auction is complete if there was a bid, and the time has run out.
    modifier auctionComplete(uint256 auctionId) {
        if (auctions[auctionId].auctionType == LibExchangeAuction.AuctionTypes.Dutch) {
            require(auctions[auctionId].firstBidTime != 0, "DAHC");
        } else {    
            /// Auction is complete if there has been a bid, and the current time
            /// is greater than the auction's end time.    
            require(auctions[auctionId].firstBidTime > 0 && block.timestamp >= auctionEnds(auctionId),
                "AHC"
            );
        }
        _;
    }

    /// ============ Constructor ============

    function __ReserveAuctionV3_init_unchained(address adminRecoveryAddress_)
        internal
        initializer
    {
        adminRecoveryAddress = adminRecoveryAddress_;
        /// Initialize mutable memory.
        _paused = false;
        __Ownable_init_unchained();
        setMinBidIncrementPercent(5);
        /// 10 minutes
        setMinAuctionDuration(60 * 10);
        /// 30 days
        setMaxAuctionDuration(60 * 60 * 24 * 30);
    }
    
    function setMinBidIncrementPercent(uint8 minBidIncrementPercentExtVar) public onlyOwner {
        minBidIncrementPercentAuction = minBidIncrementPercentExtVar;
    }

    function setMinAuctionDuration(uint256 minDurationExtVar) public onlyOwner {
        minAuctionDuration = minDurationExtVar;
    }

    function setMaxAuctionDuration(uint256 maxDurationExtVar) public onlyOwner {
        maxAuctionDuration = maxDurationExtVar;
    }

    /// ============ Create Auction ============

    function createAuction(
        uint256 tokenId,
        uint256 duration,
        uint256 reservePrice,
        LibExchangeAuction.AuctionTypes auctionType,
        uint256 startingPrice,
        uint256 endingPrice,
        uint256 startDate,
        uint256 extensionPeriod,
        address[3] memory auctionSpecAddr,
        uint8 erc1155TokenAmount
    ) external nonReentrant whenNotPaused {
        _auctionId.increment();
        /// Check basic input requirements are reasonable.
        require(
            duration >= minAuctionDuration && duration <= maxAuctionDuration,
            "DIETLOTH"
        );
        require(
            // maximum of 60 minutes for extension period
            extensionPeriod >= 0 && extensionPeriod <= 3600,
            "EPHTBLOH"
        );
        if (auctionType == LibExchangeAuction.AuctionTypes.Dutch) {
            require(startingPrice > 0, "ASPGZ");
            require(endingPrice > 0, "AEPGZ");
            require(startingPrice > endingPrice, "ASPGEP");
        }
        /// Initialize the auction details, including null values.
        auctions[this.getCurrentAuctionId()] = LibExchangeAuction.Auction({
            duration: duration,
            reservePrice: reservePrice,
            tokenId: tokenId,
            amount: 0,
            firstBidTime: 0,
            bidder: payable(address(0)),
            auctionType: auctionType,
            /// start date can not be in the past
            startingAt: startDate > block.timestamp ? startDate : block.timestamp,
            startingPrice: startingPrice,
            endingPrice: endingPrice,
            extensionPeriod: extensionPeriod,
            /// 0: creator, 1: nftContract, 2: currencyTokenContract
            auctionSpecAddr: auctionSpecAddr,
            erc1155TokenAmount: erc1155TokenAmount
        });
        if(IERC165Upgradeable(auctionSpecAddr[1]).supportsInterface(ERC721_INTERFACE_ID)){
            IERC721Upgradeable(auctionSpecAddr[1]).transferFrom(
                msg.sender,
                address(this),
                tokenId
            );
        } else if(IERC165Upgradeable(auctionSpecAddr[1]).supportsInterface(ERC1155_INTERFACE_ID)){
            IERC1155Upgradeable(auctionSpecAddr[1]).safeTransferFrom(
                msg.sender, 
                address(this), 
                tokenId, 
                erc1155TokenAmount,
                '0x');
        } else {
            revert("CANADNSNI");
        }

        // Transfer the NFT into this auction contract, from whoever owns it.

        /// Emit an event describing the new auction.
        emit OrderCreated(
            this.getCurrentAuctionId(),
            tokenId,
            auctionSpecAddr[1],
            duration,
            reservePrice,
            endingPrice,
            auctionType,
            startDate,
            extensionPeriod,
            auctionSpecAddr,
            erc1155TokenAmount
        );
    }

    /**
     * @dev get the current _auctionId (after it was incremented)
     */
    function getCurrentAuctionId() external view returns (uint256) {
        return _auctionId.current();
    }



    /**
     * @dev Remove all auction data for this token from storage
     */
    function deleteAuction(uint256 auctionId)
        internal
        whenNotPaused
        auctionComplete(auctionId)
    {
        delete auctions[auctionId];
    }

    /**
     * @dev Admin can remove all auction data for this token from storage
     */
    function deleteAuctionOnlyAdmin(uint256 auctionId)
        public
        whenNotPaused
        onlyAdminRecovery
        auctionComplete(auctionId)
    {
        delete auctions[auctionId];
    }

    /// ============ Cancel Auction ============

    function cancelAuction(uint256 auctionId)
        external
        nonReentrant
        auctionExists(auctionId)
    {
        /// Check that there hasn't already been a bid for this NFT.
        require(
            uint256(auctions[auctionId].firstBidTime) == 0,
            "Auction already had a bid"
        );
        require(
            auctions[auctionId].auctionSpecAddr[0] == msg.sender,
            "Auction can only be cancelled by the address who created it"
        );
        /// Dutch auction can only be canceled if it has not yet started
        if (auctions[auctionId].auctionType == LibExchangeAuction.AuctionTypes.Dutch) {
            require(
                auctions[auctionId].startingAt >= block.timestamp,
                "AAS"
            );
        }
        /// Emit an event describing that the auction has been canceled.
        emit OrderCancelled(auctionId, auctions[auctionId].auctionSpecAddr[1], auctions[auctionId].tokenId);

        /// Remove all data about the auction.
        delete auctions[auctionId];


    }

    /// ============ Admin Functions ============

    function pauseContract() 
        external 
        onlyAdminRecovery 
    {
        _paused = true;
        emit Paused(msg.sender);
    }

    function unpauseContract() 
        external 
        onlyAdminRecovery 
    {
        _paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @dev Allows the admin to transfer any AVAX from this contract to the recovery address.
     */
    function recoverBNB(uint256 amount)
        external
        onlyAdminRecovery
    {
        /// Attempt an AVAX transfer to the recovery account, and return true if it succeeds.
        adminRecoveryAddress.transferEth(amount);
    }

    function recoverERC721(uint256 auctionId) external onlyAdminRecovery {
        IERC721Upgradeable(auctions[auctionId].auctionSpecAddr[1]).safeTransferFrom(
            // From the auction contract.
            address(this),
            // To the recovery account.
            adminRecoveryAddress,
            // For the specified token.
            auctions[auctionId].tokenId
        );
    }
    function recoverERC1155(uint256 auctionId) external onlyAdminRecovery {
        IERC1155Upgradeable(auctions[auctionId].auctionSpecAddr[1]).safeTransferFrom(
            // From the auction contract.
            address(this),
            // To the recovery account.
            adminRecoveryAddress,
            // For the specified token.
            auctions[auctionId].tokenId,
            auctions[auctionId].amount,
            '0x'
        );
    }

    /// ============ Miscellaneous Public and External ============

    /**
     * @dev Returns true if the contract is paused.
     */
    function paused() 
        public 
        view 
        returns (bool) 
    {
        return _paused;
    }

    /**
     * @dev The auction should not exist if the nftContract address is the null address
     * @return true if the auction's nftContract address is set to the null address.
     */ 
    function auctionNftContractIsNull(uint256 auctionId)
        private
        view
        returns (bool)
    {
        return auctions[auctionId].auctionSpecAddr[1] == address(0);
    }

    /**
     * @dev auction endtime is derived by adding the auction's duration to the time of the first bid.
     * @notice duration can be extended conditionally after each new bid is added.
     * @return the timestamp at which an auction will finish.
     */ 
    function auctionEnds(uint256 auctionId) 
        internal 
        view 
        returns (uint256) 
    {
        return auctions[auctionId].firstBidTime.add(auctions[auctionId].duration);
    }

    uint256[50] private __gap;
}
