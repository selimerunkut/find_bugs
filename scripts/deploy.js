require("@nomiclabs/hardhat-web3");
const { HardhatRuntimeEnvironment } = require('hardhat/types');

async function main() {
  const accounts = await ethers.getSigners()

  const LibExchangeAuctionFactory = await ethers.getContractFactory("LibExchangeAuction");
  const libExchangeAuction = await LibExchangeAuctionFactory.deploy();
  const ExchangeV2 = await ethers.getContractFactory("ExchangeV2", {
    libraries: {
      LibExchangeAuction: libExchangeAuction.address
    }
  });
  const TransferProxy = await ethers.getContractFactory('TransferProxy');
  const ERC20TransferProxy = await ethers.getContractFactory('ERC20TransferProxy');

  //deploy and initialize TransferProxy
  transferProxyDeployed = await TransferProxy.deploy();
  await transferProxyDeployed.__TransferProxy_init();

  //deploy and initialize ERC20TransferProxy
  erc20TransferProxyDeployed = await ERC20TransferProxy.deploy();
  await erc20TransferProxyDeployed.__ERC20TransferProxy_init();

  const transferProxy = transferProxyDeployed.address
  const erc20TransferProxy = erc20TransferProxyDeployed.address

  const exchangeFeeWallet = accounts[0].address
  const adminRecoveryAddress = accounts[0].address
  const feesBP = 200

  const instance = await upgrades.deployProxy(
    ExchangeV2,
    [transferProxy, erc20TransferProxy, feesBP, exchangeFeeWallet, adminRecoveryAddress],
    { initializer: '__ExchangeV2_init', unsafeAllowLinkedLibraries: true }
  );

  //add ExchangeV2 address to the the allowed operators of transferProxy & erc20TransferProxy
  await transferProxyDeployed.addOperator(instance.address)
  await erc20TransferProxyDeployed.addOperator(instance.address)

  console.log('ExchangeV2 Deployed', instance.address);
  console.log('transferProxy: ', transferProxy)
  console.log('erc20TransferProxy: ', erc20TransferProxy)
  console.log('exchangeFeeWallet: ', exchangeFeeWallet)
  console.log('adminRecoveryAddress: ', adminRecoveryAddress)
  console.log('libExchangeAuction deployed: ', libExchangeAuction.address);
  console.log('fees value: ', feesBP / 100 + '%')
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });