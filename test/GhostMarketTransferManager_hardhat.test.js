//const OrderValidatorTest = artifacts.require("OrderValidatorTest");
const { BigNumber } = require('ethers');

const { Order, Asset, sign } = require("./order");
const { ETH, ERC20, ERC721, ERC1155, ORDER_DATA_V1, TO_MAKER, TO_TAKER, PROTOCOL, ROYALTY, ORIGIN, PAYOUT, enc, id, NFT_TRANSFER_FROM_CONTRACT } = require("./assets");
const { chai, expect } = require('chai')
const ZERO = "0x0000000000000000000000000000000000000000";
const {
	expectRevert,
	ether
} = require('@openzeppelin/test-helpers');
const { TOKEN_NAME, TOKEN_SYMBOL, BASE_URI, METADATA_JSON, getLastTokenID, verifyBalanceChange } = require('./include_in_tesfiles.js')

const hardhat = require('hardhat')



describe('Auction', async function () {

	let accounts0
	let accounts1
	let accounts2
	let accounts3
	let accounts4
	let wallet0
	let wallet1
	let wallet2
	let protocol
	let community

	let transferProxy;
	let erc20TransferProxy;
	let testing;
	let t1;
	let erc721V1;
	let ghostERC1155

	const data = '0x'
	const eth = "0x0000000000000000000000000000000000000000";


	let do_not_deploy = true
	let addOperator = false

	beforeEach(async function () {
		let accounts = await ethers.getSigners()
		accounts0 = accounts[0].address
		accounts1 = accounts[3].address
		accounts2 = accounts[4].address
		accounts3 = accounts[5].address
		accounts4 = accounts[6].address
		wallet0 = accounts[0]
		wallet1 = accounts[3]
		wallet2 = accounts[4]
		protocol = accounts[1].address;
		community = accounts[2].address;
		console.log("accounts0: ", accounts0)
		console.log("accounts1: ", accounts1)
		console.log("accounts2: ", accounts2)
		console.log("accounts3: ", accounts3)
		console.log("accounts4: ", accounts4)
		console.log("protocol: ", protocol)
		console.log("community: ", community)
		let TransferProxyTest = await ethers.getContractFactory("TransferProxy");
		let ERC20TransferProxyTest = await ethers.getContractFactory("ERC20TransferProxy");
		let GhostMarketTransferManagerTest = await ethers.getContractFactory("GhostMarketTransferManagerTest");
		let TestERC20 = await ethers.getContractFactory("TestERC20");
		let TestERC721V1 = await ethers.getContractFactory("TestERC721WithRoyalties");
		let GhostERC1155contract = await ethers.getContractFactory("TestERC1155WithRoyalties");
		if (hre.network.name == 'rinkeby_nodeploy' && do_not_deploy) {
			console.log("using existing", hre.network.name, "contracts")
			transferProxy = await TransferProxyTest.attach("0x08a8c4804b4165E7DD52d909Eb14275CF3FB643C")
			erc20TransferProxy = await ERC20TransferProxyTest.attach("0xA280aAB41d2a9999B1190A0b4467043557f734c2")
			testing = await GhostMarketTransferManagerTest.attach("0x14a6A490094bA4f8B38b8A48E4111dBcE02DC3f9")
			t1 = await TestERC20.attach("0x3018D3652c3978e9b8cb98e083F7216b7911dcED")
			erc721V1 = await TestERC721V1.attach("0xE3830eCE5DBB8910794B3743710d87550b5c84Ca")
			ghostERC1155 = await GhostERC1155contract.attach("")
		} else if (hre.network.name == 'bsctestnet_nodeploy' && do_not_deploy) {
			console.log("using existing", hre.network.name, "contracts")
			transferProxy = await TransferProxyTest.attach("0xc8a0b15AEcDFF7bc04D757ebE4d920E96C1E6DF6")
			erc20TransferProxy = await ERC20TransferProxyTest.attach("0x8f93a447BEaD86260A5D179cFC92c9655e2366F6")
			testing = await GhostMarketTransferManagerTest.attach("0xE1E656b7Ae62be77C457e429993f0caC126125Ee")
			t1 = await TestERC20.attach("0x71377d8Fc14240D17598c327507017e7dA6Af5B7")
			erc721V1 = await TestERC721V1.attach("0x08AD47305159d1b34323468e55892d58846b388E")
			ghostERC1155 = await GhostERC1155contract.attach("0x388f3bA3b5C55E7B2Df5868a255d050A54Eed6ea")
		} else {
			console.log("deploying contracts")
			addOperator = true

			transferProxy = await TransferProxyTest.deploy();
			await transferProxy.__TransferProxy_init();

			erc20TransferProxy = await ERC20TransferProxyTest.deploy();
			await erc20TransferProxy.__ERC20TransferProxy_init();

			testing = await GhostMarketTransferManagerTest.deploy();
			await testing.__TransferManager_init(transferProxy.address, erc20TransferProxy.address, 300, community);

			t1 = await TestERC20.deploy();
			erc721V1 = await TestERC721V1.deploy();
			await erc721V1.initialize(TOKEN_NAME, TOKEN_SYMBOL, BASE_URI);

			ghostERC1155 = await GhostERC1155contract.deploy();
			await ghostERC1155.initialize(TOKEN_NAME, TOKEN_SYMBOL, BASE_URI);

			//fee receiver for ETH transfer is the protocol address
			await testing.setDefaultFeeReceiver(protocol);
			await transferProxy.addOperator(testing.address)
			await erc20TransferProxy.addOperator(testing.address)
		}
		if (addOperator) {
			await transferProxy.addOperator(testing.address)
			await erc20TransferProxy.addOperator(testing.address)
		}


		console.log('deployed transferProxy: ', transferProxy.address);
		console.log('deployed erc20TransferProxy: ', erc20TransferProxy.address);
		console.log('deployed GhostMarketTransferManagerTest contract: ', testing.address);
		console.log('deployed t1: ', t1.address);
		console.log('deployed erc721V1: ', erc721V1.address);
		console.log('deployed ghostERC1155: ', ghostERC1155.address);
	});

	/* it("eth orders work, rest is returned to taker (other side) ", async () => {
		await t1.mint(accounts1, 100);
		let t1AsSigner = await t1.connect(wallet1);

		await t1AsSigner.approve(erc20TransferProxy.address, 10000000, { from: accounts1 });

		const left = Order(accounts2, Asset(ETH, "0x", 200), ZERO, Asset(ERC20, enc(t1.address), 100), 1, 0, 0, "0xffffffff", "0x");
		const right = Order(accounts1, Asset(ERC20, enc(t1.address), 100), ZERO, Asset(ETH, "0x", 200), 1, 0, 0, "0xffffffff", "0x");

		let signatureRight = await getSignature(right, accounts1);
		let signatureLeft = await getSignature(left, accounts2);

		let testingAsSigner = await testing.connect(wallet2);
		let result
		if (hre.network.name == 'rinkeby_nodeploy' || hre.network.name == 'bsctestnet_nodeploy') {
			console.log("matchOrders on rinkeby")
			let account1T1BalanceBefore = (await t1.balanceOf(accounts1)).toString()
			let account2T1BalanceBefore = (await t1.balanceOf(accounts2)).toString()
			let tx = await testingAsSigner.matchOrders(left, "0x", right, signatureRight, { from: accounts2, value: 300 })
			console.log("tx: ", tx)

			let account1T1BalanceAfter = (await t1.balanceOf(accounts1)).toString()
			let account2T1BalanceAfter = (await t1.balanceOf(accounts2)).toString()

			console.log("account1T1BalanceBefore:", account1T1BalanceBefore)
			console.log("account2T1BalanceBefore:", account2T1BalanceBefore)
			console.log("account1T1BalanceAfter:", account1T1BalanceAfter)
			console.log("account2T1BalanceAfter:", account2T1BalanceAfter)


		} else {
			console.log("matchOrders on local")
			await verifyBalanceChange(accounts2, 206, async () =>
				verifyBalanceChange(accounts1, -200, async () =>
					verifyBalanceChange(protocol, -6, () =>
						testingAsSigner.matchOrders(left, "0x", right, signatureRight, { from: accounts2, value: 300, gasPrice: 0 })
					)
				)
			)
			console.log("accounts1 token balance: ", (await t1.balanceOf(accounts1)).toString())
			console.log("accounts2 token balance: ", (await t1.balanceOf(accounts2)).toString())

			expect((await t1.balanceOf(accounts1)).toString()).to.equal('0');
			expect((await t1.balanceOf(accounts2)).toString()).to.equal('100');
		}
	}) */

	// can be used with testnets
	it("From ETH(DataV1) to ERC721(RoyalytiV1, DataV1) Protocol, Origin fees, Royalties", async () => {
		await erc721V1.mintGhost(accounts1, [[accounts2, 300], [accounts3, 400]], "ext_uri", "", "");
		const erc721TokenId1 = (await erc721V1.getLastTokenID()).toString()
		let erc721V1AsSigner = await erc721V1.connect(wallet1);


		if (hre.network.name == 'rinkeby_nodeploy' || hre.network.name == 'bsctestnet_nodeploy') {
			await erc721V1AsSigner.setApprovalForAll(transferProxy.address, true, { from: accounts1 })
			console.log('erc721V1 isApprovedForAll: ', await erc721V1.isApprovedForAll(accounts1, transferProxy.address));
		} else {
			const { events } = await (
				await erc721V1AsSigner.setApprovalForAll(transferProxy.address, true, { from: accounts1 })
			).wait()
			//test token approval status	
			const [eventObject] = events;
			expect(eventObject.event).eq('ApprovalForAll');
			expect(eventObject.args.owner).eq(accounts1);
			expect(eventObject.args.operator).eq(transferProxy.address);
			expect(eventObject.args.approved).eq(true);
		}
		await erc721V1AsSigner.transferFrom(accounts1, testing.address, erc721TokenId1, { from: accounts1 });
		expect((await erc721V1.balanceOf(testing.address)).toString()).to.equal('1');
		console.log("contract NFT balance: ", (await erc721V1.balanceOf(testing.address)).toString())


		console.log("NFT_TRANSFER_FROM_CONTRACT", NFT_TRANSFER_FROM_CONTRACT)
		const left = Order(accounts0, Asset(ETH, "0x", 200), ZERO, Asset(ERC721, enc(erc721V1.address, erc721TokenId1), 1), 1, 0, 0, NFT_TRANSFER_FROM_CONTRACT, "0x");
		const right = Order(accounts1, Asset(ERC721, enc(erc721V1.address, erc721TokenId1), 1), ZERO, Asset(ETH, "0x", 200), 1, 0, 0, NFT_TRANSFER_FROM_CONTRACT, "0x");

		//let signatureRight = await getSignature(right, accounts1);
		// console.log('left: ', left);
		// console.log('right: ', right);
		console.log("accounts2 royalty balance before: ", (await web3.eth.getBalance(accounts2)).toString())
		console.log("accounts3 royalty balance before: ", (await web3.eth.getBalance(accounts3)).toString())

		console.log("protocol balance before: ", (await web3.eth.getBalance(protocol)).toString())
		console.log("community balance before: ", (await web3.eth.getBalance(community)).toString())

		console.log("seller token balance: ", (await erc721V1.balanceOf(accounts1)).toString())
		console.log("buyer token balance: ", (await erc721V1.balanceOf(accounts0)).toString())

		if (hre.network.name == 'rinkeby_nodeploy' || hre.network.name == 'bsctestnet_nodeploy') {
			console.log('matchAndTransfer on', hre.network.name);
			let tx = await testing.checkDoTransfers(left, "0x", right, signatureRight, { from: accounts0, value: 300 })
			tx.wait()
			console.log("tx: ", tx)
		}
		else {
			console.log("local testnet:", hre.network.name)
			await verifyBalanceChange(accounts0, 300, async () =>			//200+6buyerFee (72back)
				verifyBalanceChange(accounts1, -186, async () =>				//200 - (6+8royalties)
					verifyBalanceChange(accounts2, -6, async () =>
						verifyBalanceChange(accounts3, -8, async () =>
							verifyBalanceChange(protocol, -6, () =>
								testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [200, 1], left, right, { from: accounts0, value: 300, gasPrice: 0 })
							)
						)
					)
				)
			)

			expect((await erc721V1.balanceOf(accounts1)).toString()).to.equal('0');
			expect((await erc721V1.balanceOf(accounts0)).toString()).to.equal('1');
		}

		console.log("protocol balance after: ", (await web3.eth.getBalance(protocol)).toString())
		console.log("community balance after: ", (await web3.eth.getBalance(community)).toString())

		console.log("accounts2 royalty balance after: ", (await web3.eth.getBalance(accounts2)).toString())
		console.log("accounts3 royalty balance after: ", (await web3.eth.getBalance(accounts3)).toString())

		console.log("seller token balance: ", (await erc721V1.balanceOf(accounts1)).toString())
		console.log("buyer token balance: ", (await erc721V1.balanceOf(accounts0)).toString())

	})

	async function prepare_ERC_1155V1_Orders(erc1155amount = 10) {
		await ghostERC1155.mintGhost(accounts1, erc1155amount, data, [[accounts3, 1000], [accounts4, 500]], "ext_uri", "", "")
		const erc1155TokenId1 = (await getLastTokenID(ghostERC1155)).toString()
		console.log("erc1155TokenId1", erc1155TokenId1)

		let erc1155AsSigner = await ghostERC1155.connect(wallet1);

		await erc1155AsSigner.safeTransferFrom(accounts1, testing.address, erc1155TokenId1, 4, data)

		await erc1155AsSigner.setApprovalForAll(transferProxy.address, true, { from: accounts1 });

		const left = Order(accounts2, Asset(ETH, "0x", 200), ZERO, Asset(ERC1155, enc(ghostERC1155.address, erc1155TokenId1), 4), 1, 0, 0, NFT_TRANSFER_FROM_CONTRACT, "0x");
		const right = Order(accounts1, Asset(ERC1155, enc(ghostERC1155.address, erc1155TokenId1), 4), ZERO, Asset(ETH, "0x", 200), 1, 0, 0, NFT_TRANSFER_FROM_CONTRACT, "0x");
		return { left, right, erc1155TokenId1 }
	}

	// can be used with testnets
	it.only("should buy ERC1155 with ETH; protocol fee and royalties", async () => {
		let matchSigner = await testing.connect(wallet2);

		const { left, right, erc1155TokenId1 } = await prepare_ERC_1155V1_Orders()

		console.log(accounts1, "accounts1 balance before: ", (await web3.eth.getBalance(accounts1)).toString())
		console.log(accounts2, "accounts2  balance before: ", (await web3.eth.getBalance(accounts2)).toString())
		console.log(accounts3, "accounts3  balance before: ", (await web3.eth.getBalance(accounts3)).toString())
		console.log(accounts4, "accounts4  balance before: ", (await web3.eth.getBalance(accounts4)).toString())
		console.log(protocol, "protocol balance before: ", (await web3.eth.getBalance(protocol)).toString())
		console.log(accounts1, "accounts1 erc1155 balance before: ", (await ghostERC1155.balanceOf(accounts1, erc1155TokenId1)).toString())
		console.log(accounts2, "accounts2 erc1155 balance before: ", (await ghostERC1155.balanceOf(accounts2, erc1155TokenId1)).toString())
		

		console.log(testing.address, "erc1155 balance after transfer to contract: ", (await ghostERC1155.balanceOf(testing.address, erc1155TokenId1)).toString())


		if (hre.network.name == 'rinkeby_nodeploy' || hre.network.name == 'bsctestnet_nodeploy') {
			let result = await matchSigner.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [200, 4], left, right, { from: accounts2, value: 300 })
			console.log("matchOrders transaction", result)
		} else {
			await verifyBalanceChange(accounts2, 300, async () =>			//200 + 6 buyerFee (72back)
				verifyBalanceChange(accounts1, -170, async () =>				//200 seller - 14 
					verifyBalanceChange(accounts3, -20, async () =>
						verifyBalanceChange(accounts4, -10, async () =>
							verifyBalanceChange(protocol, -6, () =>
								matchSigner.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [200, 4], left, right, 
									{ 
										from: accounts2, value: 300, gasPrice: 0 
									}
								)
							)
						)
					)
				)
			)
			expectEqualStringValues(await ghostERC1155.balanceOf(accounts1, erc1155TokenId1), 6)
			expectEqualStringValues(await ghostERC1155.balanceOf(accounts2, erc1155TokenId1), 4)
		}
		console.log(accounts1, " accounts1  balance after: ", (await web3.eth.getBalance(accounts1)).toString())
		console.log(accounts2, " accounts2  balance after: ", (await web3.eth.getBalance(accounts2)).toString())
		console.log(accounts3, " accounts3  balance after: ", (await web3.eth.getBalance(accounts3)).toString())
		console.log(accounts4, " accounts4  balance after: ", (await web3.eth.getBalance(accounts4)).toString())
		console.log(protocol, " protocol balance after: ", (await web3.eth.getBalance(protocol)).toString())
		console.log(accounts1, " accounts1 erc1155 balance after: ", (await ghostERC1155.balanceOf(accounts1, erc1155TokenId1)).toString())
		console.log(accounts2, " accounts2 erc1155 balance after: ", (await ghostERC1155.balanceOf(accounts2, erc1155TokenId1)).toString())
	})

	async function getSignature(order, signer) {
		return sign(order, signer, testing.address);
	}

	function expectEqualStringValues(value1, value2) {
		expect(value1.toString()).to.equal(value2.toString())
	}
});








