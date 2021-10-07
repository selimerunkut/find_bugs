// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "./ERC1271.sol";
import "./LibOrder.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";

abstract contract OrderValidator is Initializable, ContextUpgradeable, EIP712Upgradeable {
    using ECDSAUpgradeable for bytes32;
    using AddressUpgradeable for address;

    bytes4 constant internal MAGICVALUE = 0x1626ba7e;

    function __OrderValidator_init_unchained() internal initializer {
        __EIP712_init_unchained("GhostMarket", "2");
    }

    function getChainId() external view returns (uint256 chainId) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        // solhint-disable-next-line no-inline-assembly
        assembly {
            chainId := chainid()
        }
    }

    /**
     * @dev if order maker is _msgSender() do nothing
     * else if order maker is a contract its signature must match MAGICVALUE (see also ERC1271)
     * else if order maker is a user signature must match order.maker (see ECDSAUpgradeable)
     */
    function validate(LibOrder.Order memory order, bytes memory signature) internal view {

        if (_msgSender() != order.maker) {
            bytes32 hash = LibOrder.hash(order);
            if (order.maker.isContract()) {
                require(
                    ERC1271(order.maker).isValidSignature(hashSomething(hash), signature) == MAGICVALUE,
                    "Contract: signature verification error"
                );
            } else {
                require(
                    hashSomething(hash).recover(signature) == order.maker,
                    "User: signature verification error"
                );
            }
        }
    }

    function hashSomething(bytes32 structHash) internal view returns (bytes32) {
        bytes32 hashedName = keccak256(bytes("GhostMarket"));
        bytes32 hashedVersion = keccak256(bytes("2"));
        bytes32 _TYPE_HASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
        bytes32 customSeparator = keccak256(abi.encode(
                _TYPE_HASH,
                hashedName,
                hashedVersion,
                block.chainid,
                address(this)
            ));
        return ECDSAUpgradeable.toTypedDataHash(customSeparator, structHash);
    }

    uint256[50] private __gap;
}
