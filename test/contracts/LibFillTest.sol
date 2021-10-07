// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import "../../src/LibOrder.sol";
import "../../src/LibFill.sol";

contract LibFillTest {
    function fillOrder(LibOrder.Order calldata leftOrder, LibOrder.Order calldata rightOrder, uint leftOrderFill, uint rightOrderFill) external pure returns (LibFill.FillResult memory) {
        return LibFill.fillOrder(leftOrder, rightOrder, leftOrderFill, rightOrderFill);
    }
}
