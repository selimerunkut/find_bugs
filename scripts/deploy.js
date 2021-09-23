require("@nomiclabs/hardhat-web3");
const { HardhatRuntimeEnvironment } = require('hardhat/types');
const { generatedWallets } = require('../test/generatedWallets');
const { JsonRpcProvider } = require('@ethersproject/providers');
const provider = new JsonRpcProvider("http://localhost:8545");
const accounts = generatedWallets(provider);


async function main() {
  
  //const ExchangeV2 = await ethers.getContractFactory('contracts/ExchangeV2.sol_flat.sol:ExchangeV2');
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
  const adminRecoveryAddress = accounts[3].address

  const instance = await upgrades.deployProxy(
    ExchangeV2,
    [transferProxy, erc20TransferProxy, 100, exchangeFeeWallet, adminRecoveryAddress],
    { initializer: '__ExchangeV2_init', unsafeAllowLinkedLibraries: true }
  );
  //add ExchangeV2 address to the the allowed operators of transferProxy & erc20TransferProxy
  transferProxyDeployed.addOperator(instance.address)
  erc20TransferProxyDeployed.addOperator(instance.address)

  console.log('ExchangeV2 Deployed', instance.address);
  console.log('transferProxy: ', transferProxy)
  console.log('erc20TransferProxy: ', erc20TransferProxy)
  console.log('exchangeFeeWallet: ', exchangeFeeWallet)
  console.log('adminRecoveryAddress: ', adminRecoveryAddress)
  console.log('libExchangeAuction deployed: ', libExchangeAuction.address);
  console.log('fee: ', 100)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });