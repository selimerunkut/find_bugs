
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer} = await getNamedAccounts();
  
  
  const TransferProxy = await hre.deployments.get('TransferProxy');
  const ERC20TransferProxy = await hre.deployments.get('ERC20TransferProxy');
  const feesBP = 200

  await deploy('ExchangeV2', {
    from: deployer,
    proxy: {
      owner: deployer,
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        init: {
          methodName: '__ExchangeV2_init',
          args: [TransferProxy.address, ERC20TransferProxy.address, feesBP, deployer, deployer],
        },
      },
    },
    log: true,
  });
  console.log('transferProxy: ', TransferProxy.address)
  console.log('erc20TransferProxy: ', ERC20TransferProxy.address)
  console.log('exchangeFeeWallet: ', deployer)
  console.log('adminRecoveryAddress: ', deployer)
  console.log('fees value: ', feesBP / 100 + '%')
};
export default func;
func.tags = ['ExchangeV2'];
module.exports.dependencies = ['TransferProxy', 'ERC20TransferProxy']; // this ensure the Token script above is executed first, so `deployments.get('Token')` succeeds