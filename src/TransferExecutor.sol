// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;


import "./interfaces/ITransferProxy.sol";
import "./interfaces/INftTransferProxy.sol";
import "./interfaces/IERC20TransferProxy.sol";
import "./ITransferExecutor.sol";
import "./lib/LibTransfer.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract TransferExecutor is Initializable, OwnableUpgradeable, ITransferExecutor {
    using LibTransfer for address;

    mapping (bytes4 => address) proxies;

    event ProxyChange(bytes4 indexed assetType, address proxy);

    bytes4 constant NFT_TRANSFER_FROM_CONTRACT = bytes4(keccak256("NFT_TRANSFER_FROM_CONTRACT"));

    function __TransferExecutor_init_unchained(INftTransferProxy transferProxy, IERC20TransferProxy erc20TransferProxy) internal {
        proxies[LibAsset.ERC20_ASSET_CLASS] = address(erc20TransferProxy);
        proxies[LibAsset.ERC721_ASSET_CLASS] = address(transferProxy);
        proxies[LibAsset.ERC1155_ASSET_CLASS] = address(transferProxy);
    }

    function setTransferProxy(bytes4 assetType, address proxy) onlyOwner public {
        proxies[assetType] = proxy;
        emit ProxyChange(assetType, proxy);
    }

    function transfer(
        LibAsset.Asset memory asset,
        address from,
        address to,
        bytes4 transferDirection,
        bytes4 transferType
    ) internal override {
        if (asset.assetType.assetClass == LibAsset.ETH_ASSET_CLASS) {
            to.transferEth(asset.value);
        } else if (asset.assetType.assetClass == LibAsset.ERC20_ASSET_CLASS) {
            (address token) = abi.decode(asset.assetType.data, (address));
            IERC20TransferProxy(proxies[LibAsset.ERC20_ASSET_CLASS]).erc20safeTransferFrom(IERC20Upgradeable(token), from, to, asset.value);
        } else if (asset.assetType.assetClass == LibAsset.ERC721_ASSET_CLASS) {
            (address token, uint tokenId) = abi.decode(asset.assetType.data, (address, uint256));
            require(asset.value == 1, "erc721 value error");
            if(transferDirection == NFT_TRANSFER_FROM_CONTRACT){
                IERC721Upgradeable(token).transferFrom(address(this), to, tokenId);
            } else {
                INftTransferProxy(proxies[LibAsset.ERC721_ASSET_CLASS]).erc721safeTransferFrom(IERC721Upgradeable(token), from, to, tokenId);
            }
        } else if (asset.assetType.assetClass == LibAsset.ERC1155_ASSET_CLASS) {
            (address token, uint tokenId) = abi.decode(asset.assetType.data, (address, uint256));
            if(transferDirection == NFT_TRANSFER_FROM_CONTRACT){
                IERC1155Upgradeable(token).safeTransferFrom(address(this), to, tokenId, asset.value, "");
            } else{
                INftTransferProxy(proxies[LibAsset.ERC1155_ASSET_CLASS]).erc1155safeTransferFrom(IERC1155Upgradeable(token), from, to, tokenId, asset.value, "");
            }
        } else {
            ITransferProxy(proxies[asset.assetType.assetClass]).transfer(asset, from, to);
        }
        emit Transfer(asset, from, to, transferDirection, transferType);
    }

    uint256[49] private __gap;
}
