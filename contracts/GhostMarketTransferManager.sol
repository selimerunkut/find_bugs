// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import "./LibFeeSide.sol";
import "./ITransferManager.sol";
import "./LibOrderData.sol";
import "./lib/BpLibrary.sol";
import "./GhostMarketRoyalties.sol";

abstract contract GhostMarketTransferManager is OwnableUpgradeable, ITransferManager, GhostMarketRoyalties {
    using BpLibrary for uint;
    using SafeMathUpgradeable for uint;

    uint public protocolFee;

    address public defaultFeeReceiver;

    function __GhostMarketTransferManager_init_unchained(
        uint newProtocolFee,
        address newDefaultFeeReceiver
    ) internal initializer {
        protocolFee = newProtocolFee;
        defaultFeeReceiver = newDefaultFeeReceiver;
    }

    function setProtocolFee(uint newProtocolFee) external onlyOwner {
        protocolFee = newProtocolFee;
    }

    function setDefaultFeeReceiver(address payable newDefaultFeeReceiver) external onlyOwner {
        defaultFeeReceiver = newDefaultFeeReceiver;
    }

    /**
     * LibFill [1, 100] makeValue: 1 takeValue: 100
     */
    function doTransfers(
        LibAsset.AssetType memory makeMatch,
        LibAsset.AssetType memory takeMatch,
        LibFill.FillResult memory fill,
        LibOrder.Order memory leftOrder,
        LibOrder.Order memory rightOrder
    ) override internal returns (uint totalMakeValue, uint totalTakeValue) {
        LibFeeSide.FeeSide feeSide = LibFeeSide.getFeeSide(makeMatch.assetClass, takeMatch.assetClass);
        LibOrderDataV1.DataV1 memory leftOrderData = LibOrderData.parse(leftOrder);
        LibOrderDataV1.DataV1 memory rightOrderData = LibOrderData.parse(rightOrder);
        if(leftOrder.dataType == LibOrderDataV1.NFT_TRANSFER_FROM_CONTRACT || rightOrder.dataType == LibOrderDataV1.NFT_TRANSFER_FROM_CONTRACT){
            if (feeSide == LibFeeSide.FeeSide.MAKE) {
                totalMakeValue = doTransfersWithFees(fill.makeValue, leftOrder.maker, leftOrderData, rightOrderData, makeMatch, takeMatch, LibOrderDataV1.NFT_TRANSFER_FROM_CONTRACT);
                transferPayouts(takeMatch, fill.takeValue, rightOrder.maker, leftOrderData.payouts, LibOrderDataV1.NFT_TRANSFER_FROM_CONTRACT);
            } else if (feeSide == LibFeeSide.FeeSide.TAKE) {
                totalTakeValue = doTransfersWithFees(fill.takeValue, rightOrder.maker, rightOrderData, leftOrderData, takeMatch, makeMatch, LibOrderDataV1.NFT_TRANSFER_FROM_CONTRACT);
                transferPayouts(makeMatch, fill.makeValue, leftOrder.maker, rightOrderData.payouts, LibOrderDataV1.NFT_TRANSFER_FROM_CONTRACT);
            }
        } else {
            if (feeSide == LibFeeSide.FeeSide.MAKE) {
                totalMakeValue = doTransfersWithFees(fill.makeValue, leftOrder.maker, leftOrderData, rightOrderData, makeMatch, takeMatch,  TO_TAKER);
                transferPayouts(takeMatch, fill.takeValue, rightOrder.maker, leftOrderData.payouts, TO_MAKER);
            } else if (feeSide == LibFeeSide.FeeSide.TAKE) {
                totalTakeValue = doTransfersWithFees(fill.takeValue, rightOrder.maker, rightOrderData, leftOrderData, takeMatch, makeMatch, TO_MAKER);
                transferPayouts(makeMatch, fill.makeValue, leftOrder.maker, rightOrderData.payouts, TO_TAKER);
            }
        }
    }
    
    function doTransfersWithFees(
        uint amount,
        address from,
        LibOrderDataV1.DataV1 memory dataCalculate,
        LibOrderDataV1.DataV1 memory dataNft,
        LibAsset.AssetType memory matchCalculate,
        LibAsset.AssetType memory matchNft,
        bytes4 transferDirection
    ) internal returns (uint totalAmount) {
        // calculate the total transfer amount with all fees
        totalAmount = calculateTotalAmount(amount, protocolFee, dataCalculate.originFees);
        //transfer the protocol fee and get the rest amount
        uint rest = transferProtocolFee(totalAmount, amount, from, matchCalculate, transferDirection);
        //transfer the royalty fee and get the rest amount
        rest = transferRoyalties(matchCalculate, matchNft, rest, amount, from, transferDirection);
        //transfer the payment for the asset to the beneficiaries (maker)
        transferPayouts(matchCalculate, rest, from, dataNft.payouts, transferDirection);
    }
    /**
     * @dev if the assetClass is ERC20_ASSET_CLASS or ERC1155_ASSET_CLASS
     * fees are transfered 
     */
    function transferProtocolFee(
        uint totalAmount,
        uint amount,
        address from,
        LibAsset.AssetType memory matchCalculate,
        bytes4 transferDirection
    ) internal returns (uint) {
        /// only taker pays protocol fee
        (uint rest, uint fee) = subFeeInBp(totalAmount, amount, protocolFee);
        if (fee > 0) {
            address tokenAddress = address(0);
            if (matchCalculate.assetClass == LibAsset.ERC20_ASSET_CLASS) {
                tokenAddress = abi.decode(matchCalculate.data, (address));
            } else if (matchCalculate.assetClass == LibAsset.ERC1155_ASSET_CLASS) {
                uint tokenId;
                (tokenAddress, tokenId) = abi.decode(matchCalculate.data, (address, uint));
            }
            transfer(LibAsset.Asset(matchCalculate, fee), from, defaultFeeReceiver, transferDirection, PROTOCOL);
        }
        return rest;
    }

    function transferRoyalties(
        LibAsset.AssetType memory matchCalculate,
        LibAsset.AssetType memory matchNft,
        uint rest,
        uint amount,
        address from,
        bytes4 transferDirection
    ) internal returns (uint restValue){
        restValue = rest;
        if (matchNft.assetClass != LibAsset.ERC1155_ASSET_CLASS && matchNft.assetClass != LibAsset.ERC721_ASSET_CLASS) {
            return restValue;
        }
        //does not like token ids with 0 value
        (address token, uint tokenId) = abi.decode(matchNft.data, (address, uint));
        Royalty[] memory fees = getRoyalties(token, tokenId);
        for (uint256 i = 0; i < fees.length; i++) {
            (uint newRestValue, uint feeValue) = subFeeInBp(restValue, amount, fees[i].value);
            restValue = newRestValue;
            if (feeValue > 0) {
                transfer(LibAsset.Asset(matchCalculate, feeValue), from, fees[i].recipient, transferDirection, ROYALTY);
            }
        }
        return restValue;
    }


    function getRoyalties(address token, uint tokenId) internal view returns (Royalty[] memory royaltyArray) {

		if (IERC165Upgradeable(token).supportsInterface(GhostMarketRoyalties._GHOSTMARKET_NFT_ROYALTIES)) {
			GhostMarketRoyalties royalities = GhostMarketRoyalties(token);
            return royalities.getRoyalties(tokenId);
	    }
    }

    function transferPayouts(
        LibAsset.AssetType memory matchCalculate,
        uint amount,
        address from,
        LibPart.Part[] memory payouts,
        bytes4 transferDirection
    ) internal {
        uint sumBps = 0;
        for (uint256 i = 0; i < payouts.length; i++) {
            uint currentAmount = amount.bp(payouts[i].value);
            sumBps = sumBps.add(payouts[i].value);
            if (currentAmount > 0) {
                transfer(LibAsset.Asset(matchCalculate, currentAmount), from, payouts[i].account, transferDirection, PAYOUT);
            }
        }
        require(sumBps == 10000, "Sum payouts Bps not equal 100%");
    }

    function calculateTotalAmount(
        uint amount,
        uint feeOnTopBp,
        LibPart.Part[] memory orderOriginFees
    ) internal pure returns (uint total){
        total = amount.add(amount.bp(feeOnTopBp));
        for (uint256 i = 0; i < orderOriginFees.length; i++) {
            total = total.add(amount.bp(orderOriginFees[i].value));
        }
    }

    function subFeeInBp(uint value, uint total, uint feeInBp) internal pure returns (uint newValue, uint realFee) {
        return subFee(value, total.bp(feeInBp));
    }

    function subFee(uint value, uint fee) internal pure returns (uint newValue, uint realFee) {
        if (value > fee) {
            newValue = value.sub(fee);
            realFee = fee;
        } else {
            newValue = 0;
            realFee = value;
        }
    }


    uint256[46] private __gap;
}
