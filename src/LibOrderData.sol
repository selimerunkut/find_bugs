// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "./LibOrder.sol";

import "./LibOrderDataV1.sol";


library LibOrderData {

    function parse(LibOrder.Order memory order) pure internal returns (LibOrderDataV1.DataV1 memory dataOrder) {
        if (order.dataType == LibOrderDataV1.V1) {
            dataOrder = LibOrderDataV1.decodeOrderDataV1(order.data);
            if (dataOrder.payouts.length == 0) {
                dataOrder = payoutSet(order.maker, dataOrder);
            }
        } else if (order.dataType == 0xffffffff || order.dataType == LibOrderDataV1.NFT_TRANSFER_FROM_CONTRACT) {
            dataOrder = payoutSet(order.maker, dataOrder);
        } else {
            revert("Unknown Order data type");
        }
    }

    function payoutSet(
        address orderAddress,
        LibOrderDataV1.DataV1 memory dataOrderOnePayoutIn
    ) pure internal returns (LibOrderDataV1.DataV1 memory ) {
        LibPart.Part[] memory payout = new LibPart.Part[](1);
        payout[0].account = payable(orderAddress);
        payout[0].value = 10000;
        dataOrderOnePayoutIn.payouts = payout;
        return dataOrderOnePayoutIn;
    }
}
