// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

abstract contract GhostMarketRoyalties {

    struct Royalty {
		address payable recipient;
		uint256 value;
	}
    /**
	 * @dev bytes4(keccak256(_GHOSTMARKET_NFT_ROYALTIES)) == 0xe42093a6
	 */
	bytes4 constant _GHOSTMARKET_NFT_ROYALTIES = bytes4(keccak256("_GHOSTMARKET_NFT_ROYALTIES"));

    /**
     * @dev get NFT royalties Royalty array
     */
    function getRoyalties(uint256 tokenId)
        external
        view
        returns (Royalty[] memory)
    {}
}
