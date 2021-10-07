// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import "../../src/AssetMatcher.sol";

/**
 * @dev AssetMatcher.sol is a abstract class and needs to be inherited to be tested
 */
contract AssetMatcherTest is Initializable, OwnableUpgradeable, AssetMatcher {

    function __AssetMatcherTest_init() external {
        __Ownable_init_unchained();
    }

    function matchAssetsTest(LibAsset.AssetType calldata leftAssetType, LibAsset.AssetType calldata rightAssetType) external view returns (LibAsset.AssetType memory) {
        return matchAssets(leftAssetType, rightAssetType);
    }
}
