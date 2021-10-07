// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "../../src/OperatorRole.sol";

contract OperatorRoleTest is OperatorRole {
    function __OperatorRoleTest_init() external initializer {
        __Ownable_init();
    }

    function getSomething() external view onlyOperator returns (uint) {
        return 10;
    }
}
