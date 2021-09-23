const { MockProvider } = require('ethereum-waffle')
const { expect } = require('chai')
const { BigNumber, BigNumberish, Bytes, ContractTransaction } = require('ethers')
const { Order, Asset } = require("./order");
const { ETH, ERC721, ERC1155, enc, NFT_TRANSFER_FROM_CONTRACT } = require("./assets");
const {
	constants,    // Common constants, like the zero address and largest integers
	expectRevert, // Assertions for transactions that should fail
	ether,
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const { TOKEN_NAME,
	TOKEN_SYMBOL, BASE_URI,
	getLastTokenID, mineTx,
	getCurrentBlockTime,
	advanceTimeAndBlock,
	verifyBalanceChange,
	eventTesting,
	etherAmountAsBigNumberWD,
	expectEqualStringValues,
	getEvents
} = require('./include_in_tesfiles.js')
const OTHER_AUCTION = 0
const CLASSIC_AUCTION = 1
const RESERVE_AUCTION = 2
const DUTCH_AUCTION = 3


describe('Auction', async function () {
	let accounts0
	let accounts1
	let accounts2
	let accounts3
	let accounts4
	let wallet0
	let wallet1
	let wallet2
	let wallet3
	let protocol
	let protocolWallet
	let community

	let testing;
	let transferProxy;
	let erc20TransferProxy;
	let transferManagerTest;
	let t1;
	let erc721V1;
	let ghostERC1155
	let libExchangeAuction
	const eth = "0x0000000000000000000000000000000000000000";
	const data = '0x'

	const ERROR_MESSAGES = {
		NOT_OWNER: 'Ownable: caller is not the owner',
		AUCTION_ALREADY_EXISTS: 'Auction already exists',
		ADNEMV: "Amount doesn't equal msg.value",
		AUCTION_EXPIRED: 'Auction expired',
		NMB: 'Must bid more than last bid by MIN_BID_INCREMENT_PERCENT amount',
		AMGT0: 'Amount must be greater than 0',
		ONLY_AUCTION_CREATOR: 'Can only be called by auction curator',
		AUCTION_ALREADY_STARTED: 'Auction already started',
		CALLER_NOT_ADMIN: 'Caller does not have admin privileges',
		CURATOR_FEE_TOO_HIGH: 'Curator fee should be < 100',
		ASPGZ: "Auction starting price must be greater then 0",
		AEPGZ: "Auction ending price must be greater then 0",
		ASPGEP: "Auction starting price must be greater then ending price",
		MSGVGEP: "Transcation message value should equal or be greater then the current price",
		CANADNSNI: "Contract at nftContractAddress address does not support NFT interface",
		DIETLOTH: "Duration is either too low or too high",
		EPHTBLOH: "Extension period has to be < 1 hour",
		CDNHAP: "Caller does not have admin privileges",
		CIP: "Contract is paused",
		ADE: "Auction doesn't exist",
		AAE: "Auction already exists",
		AE: "Auction expired",
		AHC: "Auction hasn't completed",
		DAHC: "Dutch Auction hasn't completed",
		DACOHOB: "Dutch Auction can only have one bid",
		MBRPOM: "Must bid reservePrice or more",
		ANS: "Auction not started",
		AAS: "Auction already started"
	};

	const bidCasesToTest = [
		'2000000000000000000',
		'1234567891234567891',
		'2222222222222222222',
		'3333333333333333333',
		'5555555555555555555',
		'9999999999999999999',
		// Some random bid numbers:
		'158134551011714294',
		'634204952770520617',
		'59188223259592080',
		'17570476732738631',
		'83671249304232044',
		'514248157864491240',
		'63714481580729030',
		'139296974387483490',
		'12715907252298855',
		'977541585289014023',
	];
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
		wallet3 = accounts[5]
		protocol = accounts[1].address
		protocolWallet = accounts[1]
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
		let LibExchangeAuctionFactory = await ethers.getContractFactory("LibExchangeAuction");
		libExchangeAuction = await LibExchangeAuctionFactory.deploy();
		console.log('deployed libExchangeAuction: ', libExchangeAuction.address);

		let ExchangeV2 = await ethers.getContractFactory("TestExchangeV2", {
			libraries: {
				LibExchangeAuction: libExchangeAuction.address
			}
		});
		let GhostMarketTransferManagerTest = await ethers.getContractFactory("GhostMarketTransferManagerTest");
		let TestERC20 = await ethers.getContractFactory("TestERC20");
		let TestERC721V1 = await ethers.getContractFactory("TestERC721WithRoyalties");
		let GhostERC1155contract = await ethers.getContractFactory("TestERC1155WithRoyalties");
		if (hre.network.name == 'rinkeby_nodeploy' && do_not_deploy) {
			transferProxy = await TransferProxyTest.attach("0x3A6D2FEdd3E5E6D5aC20DE61460122079319dCae")
			erc20TransferProxy = await ERC20TransferProxyTest.attach("0x75b3cddB124bC74d72870fe7d12bB0b057491E89")
			testing = await ExchangeV2.attach("0xD135B5E64662021EeC6734762DCDd9D19279D32F")
			transferManagerTest = await GhostMarketTransferManagerTest.attach("0xfA16a2D02886de0F245A903700E8D8a7aE7FAa21")
			t1 = await TestERC20.attach("0x9E31d46103809f659dF3d1D3343d68F3671555cf")
			erc721V1 = await TestERC721V1.attach("0xD9098Ec812C9a930f170D28F6D2C1E56AE6c2899")
		} else if (hre.network.name == 'bsctestnet_nodeploy' && do_not_deploy) {
			transferProxy = await TransferProxyTest.attach("0x3A6D2FEdd3E5E6D5aC20DE61460122079319dCae")
			erc20TransferProxy = await ERC20TransferProxyTest.attach("0x75b3cddB124bC74d72870fe7d12bB0b057491E89")
			testing = await ExchangeV2.attach("0xD135B5E64662021EeC6734762DCDd9D19279D32F")
			transferManagerTest = await GhostMarketTransferManagerTest.attach("0xfA16a2D02886de0F245A903700E8D8a7aE7FAa21")
			t1 = await TestERC20.attach("0x9E31d46103809f659dF3d1D3343d68F3671555cf")
			erc721V1 = await TestERC721V1.attach("0xD9098Ec812C9a930f170D28F6D2C1E56AE6c2899")
		} else {

			transferProxy = await TransferProxyTest.deploy();
			await transferProxy.__TransferProxy_init();
			erc20TransferProxy = await ERC20TransferProxyTest.deploy();
			await erc20TransferProxy.__ERC20TransferProxy_init();
			testing = await upgrades.deployProxy(ExchangeV2, [transferProxy.address, erc20TransferProxy.address, 300, community, protocol],
				{
					initializer: "__ExchangeV2_init",
					unsafeAllowLinkedLibraries: true
				});
			transferManagerTest = await GhostMarketTransferManagerTest.deploy();
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
		console.log("transferProxy.owner", await transferProxy.owner())
		console.log("erc20TransferProxy.owner", await erc20TransferProxy.owner())
		console.log('deployed transferProxy: ', transferProxy.address);
		console.log('deployed erc20TransferProxy: ', erc20TransferProxy.address);
		console.log('deployed proxy contract: ', testing.address);
		console.log('deployed transferManagerTest: ', transferManagerTest.address);
		console.log('deployed t1: ', t1.address);
		console.log('deployed erc721V1: ', erc721V1.address);
		console.log('deployed erc1155: ', erc721V1.address);
	});

	describe('createAuction', () => {
		describe('when the auction already exists', () => {
			it('should increment auctionId', async () => {
				let result1 = await setupAndCreateAuctionERC721()
				expect(result1.auctionId.toString()).eq('1')

				let result2 = await setupAndCreateAuctionERC721()
				expect(result2.auctionId.toString()).eq('2')
			});
		});
	});

	describe('cancel Auction', () => {
		it('should cancel reserve auction', async () => {
			let setupAuctionResult = await setupAndCreateAuctionERC721(auctionType = RESERVE_AUCTION, true)
			let cancelResult = await testing.cancelAuction(setupAuctionResult.tokenId)
			await eventTesting(cancelResult, testing, "OrderCancelled", {})
		});

		it('should not cancel dutch auction if already started', async () => {
			const {
				tokenId,
				duration,
				reservePrice,
				fundsRecipient,
				startingPrice,
				endingPrice,
				auctionStartDate
			} = await setupAuctionDataERC721()

			let result1 = await setupAuctionERC721(
				tokenId,
				duration,
				reservePrice,
				fundsRecipient,
				erc721V1.address,
				false,
				DUTCH_AUCTION,
				startingPrice,
				endingPrice,
				auctionStartDate
			)
			//advance time to simulate that the auction has already started 
			await advanceTimeAndBlock(duration - 100);

			await expectRevert(
				testing.cancelAuction(result1.auctionId),
				"AAS"
			)
		});
	});

	describe('createBid', () => {
		describe("should revert", () => {
			it("if the bid amount does not match the transaction message amount", async () => {
				let result1 = await setupAndCreateAuctionERC721()
				await expectRevert(
					testing.createBid(result1.auctionId, etherAmountAsBigNumberWD(1), false, { value: etherAmountAsBigNumberWD(2) }),
					"ADNEMV"
				)
			});

			it("if auction doesn't exist", async () => {
				const amount = etherAmountAsBigNumberWD(1)
				await expectRevert(
					testing.createBid(2, amount, false, { value: amount }),
					"ADE"
				)
			});

			it("if a second bid is created for dutch auction", async () => {
				let result1 = await setupAndCreateAuctionERC721(DUTCH_AUCTION)
				// amount is less then then the set reserve price
				const amount = etherAmountAsBigNumberWD(1)
				await testing.createBid(result1.auctionId, amount, false, { value: amount })

				const amount2 = etherAmountAsBigNumberWD(0.11)
				await expectRevert(
					testing.createBid(result1.auctionId, amount2, false, { value: amount2 }),
					"DACOHOB"
				)
			});
			it("if auction has not started", async () => {
				const {
					tokenId,
					duration,
					reservePrice,
					fundsRecipient,
					startingPrice,
					endingPrice,
					auctionStartDate
				} = await setupAuctionDataERC721()

				let result1 = await setupAuctionERC721(
					tokenId,
					duration,
					reservePrice,
					fundsRecipient,
					erc721V1.address,
					false,
					RESERVE_AUCTION,
					startingPrice,
					endingPrice,
					auctionStartDate + 100
				)
				const amount = etherAmountAsBigNumberWD(1)
				await expectRevert(
					testing.createBid(result1.auctionId, amount, false, { value: amount }),
					"ANS"
				)
			});
		});

		it("for classic auction, use token as payment", async () => {
			console.log("test1")
			let firstBidderWallet = wallet1
			let firstBidderAddress = accounts1
			const amount = 100

			let bidderSignerT1 = await t1.connect(firstBidderWallet);
			await t1.mint(firstBidderAddress, 100);

			await bidderSignerT1.approve(erc20TransferProxy.address, 10000000, { from: firstBidderAddress });
			//console.log("t1 balance of ",firstBidderAddress, (await t1.balanceOf(firstBidderAddress)).toString())

			let firstBidderSigner = await testing.connect(firstBidderWallet);

			//console.log("token contract balance", (await t1.balanceOf(testing.address)).toString())

			let result1 = await setupAndCreateAuctionERC721(CLASSIC_AUCTION, false, t1.address)


			await firstBidderSigner.createBid(result1.auctionId, amount, true, { from: firstBidderAddress })

			//console.log("token contract balance", (await t1.balanceOf(testing.address)).toString())
			expectEqualStringValues(await t1.balanceOf(testing.address), amount)
		});

		it("for dutch auction, use token as payment", async () => {
			let firstBidderWallet = wallet1
			let firstBidderAddress = accounts1
			const amount = 100

			let bidderSignerT1 = await t1.connect(firstBidderWallet);
			await t1.mint(firstBidderAddress, 100);

			await bidderSignerT1.approve(erc20TransferProxy.address, 10000000, { from: firstBidderAddress });
			//console.log("t1 balance of ",firstBidderAddress, (await t1.balanceOf(firstBidderAddress)).toString())

			let firstBidderSigner = await testing.connect(firstBidderWallet);

			//console.log("token contract balance", (await t1.balanceOf(testing.address)).toString())

			let result1 = await setupAndCreateAuctionERC721(CLASSIC_AUCTION, false, t1.address)


			await firstBidderSigner.createBid(result1.auctionId, amount, true, { from: firstBidderAddress })

			//console.log("token contract balance", (await t1.balanceOf(testing.address)).toString())
			expectEqualStringValues(await t1.balanceOf(testing.address), amount)
		});

		it("for classic auction, reserve price is not taken into account", async () => {
			let result1 = await setupAndCreateAuctionERC721(CLASSIC_AUCTION)
			// amount is less then then the set reserve price
			const amount = etherAmountAsBigNumberWD(0.000001)
			await testing.createBid(result1.auctionId, amount, false, { value: amount })
		});

		it("for dutch auction", async () => {
			let result1 = await setupAndCreateAuctionERC721(DUTCH_AUCTION)
			// amount is less then then the set reserve price
			const amount = etherAmountAsBigNumberWD(0.1)
			await testing.createBid(result1.auctionId, amount, false, { value: amount })
		});

		describe('when new bid amount is less than the previous bid amount', () => {
			it('should revert', async () => {
				const { auctionId } = await setupAndCreateAuctionERC721()
				const oneETH = etherAmountAsBigNumberWD(1)
				await testing.createBid(auctionId, oneETH, false, { value: oneETH })
				await expectRevert(
					testing.createBid(auctionId, oneETH, false, { value: oneETH }),
					"NMB"
				)

			});
		});

		describe('when there is an existing bid', () => {
			it('should refund the previous bidder', async () => {
				const {
					auctionId,
					tokenId,
					duration,
					reservePrice,
					nftContractAddress } = await setupAndCreateAuctionERC721()

				const oneETH = etherAmountAsBigNumberWD('1')
				const twoETH = etherAmountAsBigNumberWD('2')

				let firstBidderWallet = wallet1
				let firstBidderAddress = accounts1
				const originalBalance = await web3.eth.getBalance(firstBidderAddress)
				let firstBidderSigner = await testing.connect(firstBidderWallet);
				await firstBidderSigner.createBid(auctionId, oneETH, false, { value: oneETH, from: firstBidderAddress, gasPrice: 0 })

				const postBidBalance = await web3.eth.getBalance(firstBidderAddress)
				console.log("postBidBalance:", postBidBalance);
				console.log("originalBalance:", originalBalance);

				expect(postBidBalance.toString()).eq(
					(BigNumber.from(originalBalance).sub(oneETH)).toString()
				);

				const secondBidderWallet = wallet2
				const secondBidderAddress = accounts2
				const originalBalance2 = await web3.eth.getBalance(secondBidderAddress)
				let secondBidderSigner = await testing.connect(secondBidderWallet);

				await secondBidderSigner.createBid(auctionId, twoETH, false, { value: twoETH, from: secondBidderAddress, gasPrice: 0 })

				const postBidBalance2 = await web3.eth.getBalance(secondBidderAddress)
				console.log("postBidBalance2: " + postBidBalance2);
				console.log("originalBalance2: " + originalBalance2);

				expect(postBidBalance2.toString()).eq(
					(BigNumber.from(originalBalance2).sub(twoETH)).toString()
				);

				const currentBalanceFirstBidderWallet = await web3.eth.getBalance(firstBidderAddress)

				console.log("currentBalanceFirstBidderWallet: " + currentBalanceFirstBidderWallet);

				expect(originalBalance.toString()).eq(currentBalanceFirstBidderWallet.toString());
			});

			it('should refund the previous bidder with tokens', async () => {
				const firstBidderWallet = wallet1
				const firstBidderAddress = accounts1
				const secondBidderWallet = wallet2
				const secondBidderAddress = accounts2
				const amount = 100
				const amount2 = 200

				let bidderSignerT1 = await t1.connect(firstBidderWallet);
				let firstBidderSigner = await testing.connect(firstBidderWallet);
				let secondBidderSignerT1 = await t1.connect(secondBidderWallet);
				let secondBidderSigner = await testing.connect(secondBidderWallet);

				//let testingSignerT1 = await t1.connect(testing);


				await t1.mint(firstBidderAddress, amount * 2);
				await t1.mint(secondBidderAddress, amount2 * 2);

				const originalBalance = await t1.balanceOf(firstBidderAddress)
				const originalBalance2 = await t1.balanceOf(secondBidderAddress)
				console.log("originalBalance:", originalBalance.toString());
				console.log("originalBalance2:", originalBalance2.toString());

				await bidderSignerT1.approve(erc20TransferProxy.address, 10000000, { from: firstBidderAddress });
				await secondBidderSignerT1.approve(erc20TransferProxy.address, 10000000, { from: secondBidderAddress });

				await t1.approve(erc20TransferProxy.address, 10000000);


				//console.log("t1 balance of ",firstBidderAddress, (await t1.balanceOf(firstBidderAddress)).toString())

				console.log("token contract balance after first bid", (await t1.balanceOf(testing.address)).toString())

				let result1 = await setupAndCreateAuctionERC721(CLASSIC_AUCTION, false, t1.address)
				//create first bid
				await firstBidderSigner.createBid(result1.auctionId, amount, true, { from: firstBidderAddress })
				const postBidBalance = await t1.balanceOf(firstBidderAddress)
				console.log("postBidBalance:", postBidBalance.toString());
				expectEqualStringValues(postBidBalance, BigNumber.from(originalBalance).sub(amount))

				const contractBalance1 = await t1.balanceOf(testing.address)
				console.log("auction contract, token balance after first bid", contractBalance1.toString())

				//contract token balance
				expectEqualStringValues(contractBalance1, amount)

				//create second bid
				await secondBidderSigner.createBid(result1.auctionId, amount2, true, { from: secondBidderAddress })

				const postBidBalance2 = await t1.balanceOf(secondBidderAddress)
				console.log("postBidBalance2:", postBidBalance2.toString());

				expectEqualStringValues(postBidBalance2, BigNumber.from(originalBalance2).sub(amount2))

				const contractBalance2 = await t1.balanceOf(testing.address)

				expectEqualStringValues(contractBalance2, amount2)


				const currentBalanceFirstBidderWallet = await t1.balanceOf(firstBidderAddress)

				console.log("currentBalanceFirstBidderWallet:", currentBalanceFirstBidderWallet);

				expectEqualStringValues(originalBalance, currentBalanceFirstBidderWallet);
			});
		});
	});
	describe("when ending an auction that doesn't exist", () => {
		it('should revert', async () => {			
			await expectRevert(
				testing.deleteAuctionExternal(100),
				"AHC"
			);
		});
	});

	describe("when ending an auction that hasn't begun", () => {
		it('should revert', async () => {
			const {
				auctionId,
				tokenId,
				duration,
				reservePrice,
				nftContractAddress } = await setupAndCreateAuctionERC721()

			await expectRevert(testing.deleteAuctionExternal(auctionId),
				"AHC"
			);
		});
	});

	describe("when ending an auction that hasn't completed", () => {
		it('should revert', async () => {
			const {
				auctionId,
				tokenId,
				duration,
				reservePrice,
				nftContractAddress } = await setupAndCreateAuctionERC721()

			const oneETH = etherAmountAsBigNumberWD(1)
			let firstBidderWallet = wallet1
			let firstBidderAddress = accounts1
			let firstBidderSigner = await testing.connect(firstBidderWallet);
			let tx = await firstBidderSigner.createBid(auctionId, oneETH, false, { value: oneETH, from: firstBidderAddress, gasPrice: 0 })
			await mineTx(tx.hash)
			await expectRevert(testing.deleteAuctionExternal(auctionId),
				"AHC"
			);
		});
	});

	describe('after a valid auction', () => {
		let nftOwnerBeforeEndAuction,
			auctionBeforeEndAuction,
			auctionAfterEndAuction,
			bidAmount1,
			firstBidderWallet,
			firstBidderAddress,
			orderAmount,
			auctionId,
			tokenId,
			duration,
			reservePrice,
			nftContractAddress,
			fundsRecipientWallet

		beforeEach(async () => {
			let result = await setupAuctionDataERC721()

			tokenId = result.tokenId
			duration = result.duration
			reservePrice = result.reservePrice
			fundsRecipientWallet = result.fundsRecipientWallet

			nftContractAddress = erc721V1.address

			console.log("auctionId: ", auctionId)
			console.log("tokenId: ", tokenId)
			console.log("duration: ", duration)
			console.log("fundsRecipientWallet: ", fundsRecipientWallet)
			console.log("nftContractAddress: ", nftContractAddress)

			let setupAuctionERC721result = await setupAuctionERC721(
				tokenId,
				duration,
				reservePrice = BigNumber.from('1'),
				fundsRecipientWallet,
				nftContractAddress

			)
			auctionId = setupAuctionERC721result.auctionId
			console.log("reservePrice: ", reservePrice)

			firstBidderWallet = wallet3
			firstBidderAddress = accounts3


			bidAmount1 = 200
			orderAmount = bidAmount1 + (bidAmount1 * 0.1 + bidAmount1 * 0.05)
			console.log("orderAmount: ", orderAmount)

			console.log("auctionId: ", auctionId)
			console.log("firstBidderAddress: ", firstBidderAddress)

			let bidderSigner = await testing.connect(firstBidderWallet);
			let tx = await bidderSigner.createBid(auctionId, orderAmount, false, { value: orderAmount, from: firstBidderAddress });
			await mineTx(tx.hash)
			console.log("getCurrentBlockTime: ", await getCurrentBlockTime())

			await advanceTimeAndBlock(duration);
			console.log("getCurrentBlockTime: ", await getCurrentBlockTime())

			nftOwnerBeforeEndAuction = await erc721V1.ownerOf(
				tokenId
			);
			console.log("erc721V1.ownerOf(tokenId) address: ", await erc721V1.ownerOf(tokenId))

			const originalBalance = await web3.eth.getBalance(firstBidderAddress)
			auctionBeforeEndAuction = await testing.auctions(auctionId);
			console.log("auctionBeforeEndAuction: ", auctionBeforeEndAuction)

			let protocolSigner = await testing.connect(protocolWallet);
			await protocolSigner.deleteAuctionOnlyAdmin(auctionId, { from: protocol })
			auctionAfterEndAuction = await testing.auctions(auctionId);
			console.log("auctionAfterEndAuction: ", auctionAfterEndAuction)
		});

		it('should delete the auction', () => {
			expect(auctionBeforeEndAuction.bidder).eq(firstBidderAddress);
			expect(auctionAfterEndAuction.bidder).eq(ZERO_ADDRESS);
		});

	});

	describe("ending an auction", () => {
		it('should send ERC721 asset to buyer with royalties', async () => {
			let seller = accounts1
			let sellerWallet = wallet1
			let buyer = accounts2
			let buyerWallet = wallet2

			let {
				tokenId,
				duration,
				reservePrice,
				fundsRecipientWallet
			} = await setupAuctionDataERC721()

			const nftContractAddress = erc721V1.address


			let result = await setupAuctionERC721(
				tokenId,
				duration,
				reservePrice = BigNumber.from('1'),
				fundsRecipientWallet,
				nftContractAddress
			)

			const auctionId = result.auctionId

			let bidAmount1 = 200
			let orderAmount = bidAmount1 + (bidAmount1 * 0.1 + bidAmount1 * 0.05)
			console.log("orderAmount: ", orderAmount)

			let buyerSigner = await testing.connect(buyerWallet);
			let tx = await buyerSigner.createBid(auctionId, orderAmount, false, { value: orderAmount, from: buyer });
			await mineTx(tx.hash)
			console.log("getCurrentBlockTime: ", await getCurrentBlockTime())

			await advanceTimeAndBlock(duration);
			console.log("getCurrentBlockTime: ", await getCurrentBlockTime())

			let erc721TokenId1 = tokenId
			console.log("erc721TokenId1: ", erc721TokenId1)
			console.log("erc721TokenId1 owner address: ", await erc721V1.ownerOf(erc721TokenId1))

			//let sellerErcSigner = await erc721V1.connect(sellerWallet);
			//await sellerErcSigner.setApprovalForAll(transferProxy.address, true, { from: seller });

			// maker, makeAsset, taker, takeAsset, salt, start, end, dataType, data
			const left = Order(buyer, Asset(ETH, "0x", bidAmount1), ZERO_ADDRESS, Asset(ERC721, enc(erc721V1.address, erc721TokenId1), 1), 1, 0, 0, NFT_TRANSFER_FROM_CONTRACT, "0x");
			const right = Order(seller, Asset(ERC721, enc(erc721V1.address, erc721TokenId1), 1), ZERO_ADDRESS, Asset(ETH, "0x", bidAmount1), 1, 0, 0, NFT_TRANSFER_FROM_CONTRACT, "0x");

			await verifyBalanceChange(buyer, -24, async () =>			//payed already while bidding
				verifyBalanceChange(seller, -170, async () =>				//200 - (10+20royalties) or matchAndTransferAuction(200 -6)
					verifyBalanceChange(accounts3, -10, async () =>
						verifyBalanceChange(accounts4, -20, async () =>
							verifyBalanceChange(protocol, -6, () =>
								verifyBalanceChange(testing.address, 230, () =>
									buyerSigner.endAuctionDoTransfer(left, right, auctionId, { from: buyer, gasPrice: 0 })
								)
							)
						)
					)
				)
			)

			console.log("testing balance: ", await web3.eth.getBalance(testing.address))
			console.log("testing erc721 balance: ", await erc721V1.balanceOf(testing.address))
			console.log("seller balance: ", await web3.eth.getBalance(seller))
			console.log("buyer balance: ", await web3.eth.getBalance(buyer))
			expect((await erc721V1.balanceOf(seller)).toString()).eq("0");
			expect((await erc721V1.balanceOf(buyer)).toString()).eq("1");
		});

		it('auction creater should be able to end auction', async () => {
			let seller = accounts0
			let sellerWallet = wallet0
			let buyer = accounts2
			let buyerWallet = wallet2

			let {
				tokenId,
				duration,
				reservePrice,
				fundsRecipientWallet
			} = await setupAuctionDataERC721()

			const nftContractAddress = erc721V1.address


			let result = await setupAuctionERC721(
				tokenId,
				duration,
				reservePrice = BigNumber.from('1'),
				fundsRecipientWallet,
				nftContractAddress
			)

			const auctionId = result.auctionId

			let bidAmount1 = 200
			let orderAmount = bidAmount1 + (bidAmount1 * 0.1 + bidAmount1 * 0.05)
			console.log("orderAmount: ", orderAmount)

			let buyerSigner = await testing.connect(buyerWallet);
			let tx = await buyerSigner.createBid(auctionId, orderAmount, false, { value: orderAmount, from: buyer });
			await mineTx(tx.hash)
			console.log("getCurrentBlockTime: ", await getCurrentBlockTime())

			await advanceTimeAndBlock(duration);
			console.log("getCurrentBlockTime: ", await getCurrentBlockTime())

			let erc721TokenId1 = tokenId
			console.log("erc721TokenId1: ", erc721TokenId1)
			console.log("erc721TokenId1 owner address: ", await erc721V1.ownerOf(erc721TokenId1))

			let sellerErcSigner = await testing.connect(sellerWallet);
			//await sellerErcSigner.setApprovalForAll(transferProxy.address, true, { from: seller });

			// maker, makeAsset, taker, takeAsset, salt, start, end, dataType, data
			const left = Order(buyer, Asset(ETH, "0x", bidAmount1), ZERO_ADDRESS, Asset(ERC721, enc(erc721V1.address, erc721TokenId1), 1), 1, 0, 0, NFT_TRANSFER_FROM_CONTRACT, "0x");
			const right = Order(seller, Asset(ERC721, enc(erc721V1.address, erc721TokenId1), 1), ZERO_ADDRESS, Asset(ETH, "0x", bidAmount1), 1, 0, 0, NFT_TRANSFER_FROM_CONTRACT, "0x");

			await verifyBalanceChange(seller, -194, async () =>				//200 - (10+20royalties) or matchAndTransferAuction(200 -6)
					verifyBalanceChange(accounts3, -10, async () =>
						verifyBalanceChange(accounts4, -20, async () =>
							verifyBalanceChange(protocol, -6, () =>
								verifyBalanceChange(testing.address, 230, () =>
								sellerErcSigner.endAuctionDoTransfer(left, right, auctionId, { from: seller, gasPrice: 0 })
								)
							)
						)
					)
				)
			

			console.log("testing balance: ", await web3.eth.getBalance(testing.address))
			console.log("testing erc721 balance: ", await erc721V1.balanceOf(testing.address))
			console.log("seller balance: ", await web3.eth.getBalance(seller))
			console.log("buyer balance: ", await web3.eth.getBalance(buyer))
			expect((await erc721V1.balanceOf(seller)).toString()).eq("0");
			expect((await erc721V1.balanceOf(buyer)).toString()).eq("1");
		});

		it('dutch type, should send ERC721 asset to buyer with royalties', async () => {
			let seller = accounts1
			let sellerWallet = wallet1
			let buyer = accounts2
			let buyerWallet = wallet2

			let {
				tokenId,
				duration,
				reservePrice,
				fundsRecipientWallet,
			} = await setupAuctionDataERC721()

			const nftContractAddress = erc721V1.address


			let result = await setupAuctionERC721(
				tokenId,
				duration,
				reservePrice,
				fundsRecipientWallet,
				nftContractAddress,
				returnTransaction = true,
				auctionType = DUTCH_AUCTION,
				startingPrice = 200,
				endingPrice = 100,
			)

			const auctionId = result.auctionId

			let bidAmount1 = 300
			console.log("bidAmount1: ", bidAmount1)

			let bidAmount1PlusRoyalties = bidAmount1 + (bidAmount1 * 0.1 + bidAmount1 * 0.05)
			console.log("bidAmount1PlusRoyalties: ", bidAmount1PlusRoyalties)

			await advanceTimeAndBlock(duration - 100);
			console.log("getCurrentBlockTime: ", await getCurrentBlockTime())

			let buyerSigner = await testing.connect(buyerWallet);

			let tx = await buyerSigner.createBid(auctionId, bidAmount1PlusRoyalties, false, { value: bidAmount1PlusRoyalties, from: buyer });

			const auction = await testing.auctions(auctionId)
			console.log("get auction struct params from SC", auction)

			// auctionSpecAddr not exisitng
			const eventObject = await getEvents(testing, result.tx)
			console.log("eventObject auctionSpecAddr array", eventObject[0].args['auctionSpecAddr'])

			//console.log("dutch getCurrentPrice: ", await testing.getCurrentPrice(auctionStruct))

			await mineTx(tx.hash);
			console.log("getCurrentBlockTime: ", await getCurrentBlockTime())

			const nftPrice = parseInt((await auction.endingPrice).toString());

			console.log("auction endingPrice, nftPrice:", nftPrice)

			let nftOrderAmount = nftPrice + (nftPrice * 0.1 + nftPrice * 0.05)
			console.log("nftOrderAmount: ", nftOrderAmount)

			let erc721TokenId1 = tokenId
			console.log("erc721TokenId1: ", erc721TokenId1)
			console.log("erc721TokenId1 owner address: ", await erc721V1.ownerOf(erc721TokenId1))

			let sellerErcSigner = await erc721V1.connect(sellerWallet);
			await sellerErcSigner.setApprovalForAll(transferProxy.address, true, { from: seller });

			// maker, makeAsset, taker, takeAsset, salt, start, end, dataType, data
			const left = Order(buyer, Asset(ETH, "0x", nftPrice), ZERO_ADDRESS, Asset(ERC721, enc(erc721V1.address, erc721TokenId1), 1), 1, 0, 0, NFT_TRANSFER_FROM_CONTRACT, "0x");
			const right = Order(seller, Asset(ERC721, enc(erc721V1.address, erc721TokenId1), 1), ZERO_ADDRESS, Asset(ETH, "0x", nftPrice), 1, 0, 0, NFT_TRANSFER_FROM_CONTRACT, "0x");

			let protocolFee = nftPrice * 0.03
			console.log("protocolFee: ", protocolFee)
			let royalty1 = nftPrice * 0.1
			console.log("royalty1: ", royalty1)
			let royalty2 = nftPrice * 0.05
			console.log("royalty2: ", royalty2)
			let sellerGets = nftPrice - royalty1 - royalty2
			console.log("sellerGets: ", sellerGets)
			let buyerGets = bidAmount1PlusRoyalties - (nftPrice + protocolFee)
			console.log("buyerGets: ", buyerGets)
			console.log("testing balance before: ", await web3.eth.getBalance(testing.address))
			await verifyBalanceChange(buyer, -buyerGets, async () =>			//payed already while bidding
				verifyBalanceChange(seller, -sellerGets, async () =>
					verifyBalanceChange(accounts3, -royalty2, async () =>
						verifyBalanceChange(accounts4, -royalty1, async () =>
							verifyBalanceChange(protocol, -protocolFee, () =>
								verifyBalanceChange(testing.address, bidAmount1PlusRoyalties, () =>
									buyerSigner.endAuctionDoTransfer(left, right, auctionId, { from: buyer, gasPrice: 0 })
								)
							)
						)
					)
				)
			)
			console.log("testing balance after: ", await web3.eth.getBalance(testing.address))
			console.log("testing erc721 balance: ", await erc721V1.balanceOf(testing.address))
			console.log("seller balance: ", await web3.eth.getBalance(seller))
			console.log("buyer balance: ", await web3.eth.getBalance(buyer))
			expect((await erc721V1.balanceOf(seller)).toString()).eq("0");
			expect((await erc721V1.balanceOf(buyer)).toString()).eq("1");
		});


		it('should revert if caller is not the owner', async () => {
			let seller = accounts1
			let sellerWallet = wallet1
			let buyer = accounts2
			let buyerWallet = wallet2

			let {
				tokenId,
				duration,
				reservePrice,
				fundsRecipientWallet
			} = await setupAuctionDataERC721()

			const nftContractAddress = erc721V1.address


			let result = await setupAuctionERC721(
				tokenId,
				duration,
				reservePrice = BigNumber.from('1'),
				fundsRecipientWallet,
				nftContractAddress
			)

			const auctionId = result.auctionId

			let bidAmount1 = 200
			let orderAmount = bidAmount1 + (bidAmount1 * 0.1 + bidAmount1 * 0.05)
			console.log("orderAmount: ", orderAmount)
			let buyerSigner = await testing.connect(buyerWallet);

			let tx = await buyerSigner.createBid(auctionId, orderAmount, false, { value: orderAmount, from: buyer });
			await mineTx(tx.hash)
			console.log("getCurrentBlockTime: ", await getCurrentBlockTime())

			await advanceTimeAndBlock(duration);
			console.log("getCurrentBlockTime: ", await getCurrentBlockTime())

			let erc721TokenId1 = tokenId
			console.log("erc721TokenId1: ", erc721TokenId1)
			console.log("erc721TokenId1 owner address: ", await erc721V1.ownerOf(erc721TokenId1))

			let sellerErcSigner = await erc721V1.connect(sellerWallet);
			await sellerErcSigner.setApprovalForAll(transferProxy.address, true, { from: seller });

			// maker, makeAsset, taker, takeAsset, salt, start, end, dataType, data
			const left = Order(buyer, Asset(ETH, "0x", bidAmount1), ZERO_ADDRESS, Asset(ERC721, enc(erc721V1.address, erc721TokenId1), 1), 1, 0, 0, NFT_TRANSFER_FROM_CONTRACT, "0x");
			const right = Order(seller, Asset(ERC721, enc(erc721V1.address, erc721TokenId1), 1), ZERO_ADDRESS, Asset(ETH, "0x", bidAmount1), 1, 0, 0, NFT_TRANSFER_FROM_CONTRACT, "0x");


			await expectRevert(
				testing.endAuctionDoTransfer(left, right, auctionId),
				"Auction can only be claimed by the address who won it"
			);

		});

		it('should revert if NFT owner tries to burns the NFT, nft should be locked in the auction contract', async () => {
			let seller = accounts1
			let sellerWallet = wallet1
			let buyer = accounts2
			let buyerWallet = wallet2

			let {
				tokenId,
				duration,
				reservePrice,
			} = await setupAuctionDataERC721()

			const fundsRecipientWallet = accounts3
			const nftContractAddress = erc721V1.address

			let result = await setupAuctionERC721(
				tokenId,
				duration,
				reservePrice = BigNumber.from('1'),
				fundsRecipientWallet,
				nftContractAddress
			)

			const auctionId = result.auctionId

			let bidAmount1 = 200
			let orderAmount = bidAmount1 + (bidAmount1 * 0.1 + bidAmount1 * 0.05)
			console.log("orderAmount: ", orderAmount)

			let buyerSigner = await testing.connect(buyerWallet);
			let tx = await buyerSigner.createBid(auctionId, orderAmount, false, { value: orderAmount, from: buyer });
			await mineTx(tx.hash)
			console.log("getCurrentBlockTime: ", await getCurrentBlockTime())

			let sellerErcSigner = await erc721V1.connect(sellerWallet);
			

			await expectRevert(
				sellerErcSigner.burn(tokenId, { from: accounts1 }),
				"ERC721Burnable: caller is not owner nor approved"
			);
		});

		it('should revert, NFT owner can not moves the NFT to another account, nft should be locked in the auction contract', async () => {
			let seller = accounts1
			let sellerWallet = wallet1
			let buyer = accounts2
			let buyerWallet = wallet2
			let anotherAccount = accounts4

			let {
				tokenId,
				duration,
				reservePrice,
			} = await setupAuctionDataERC721()

			const fundsRecipientWallet = accounts3
			const nftContractAddress = erc721V1.address

			let result = await setupAuctionERC721(
				tokenId,
				duration,
				reservePrice = BigNumber.from('1'),
				fundsRecipientWallet,
				nftContractAddress
			)

			const auctionId = result.auctionId

			let bidAmount1 = 200
			let orderAmount = bidAmount1 + (bidAmount1 * 0.1 + bidAmount1 * 0.05)
			console.log("orderAmount: ", orderAmount)

			let buyerSigner = await testing.connect(buyerWallet);
			let tx = await buyerSigner.createBid(auctionId, orderAmount, false, { value: orderAmount, from: buyer });
			await mineTx(tx.hash)
			console.log("getCurrentBlockTime1: ", await getCurrentBlockTime())

			let sellerErcSigner = await erc721V1.connect(sellerWallet);

			await expectRevert(
				sellerErcSigner.transferFrom(seller, anotherAccount, tokenId, { from: seller }),
				"ERC721: transfer caller is not owner nor approved"
			);
		});
	});



	it('should emit event OrderCreated', async () => {

		let {
			tokenId,
			duration,
			reservePrice,
		} = await setupAuctionDataERC721()

		const fundsRecipientWallet = accounts3
		const nftContractAddress = erc721V1.address


		const setupAuctionResult = await setupAuctionERC721(
			tokenId,
			duration = 2000,
			reservePrice,
			fundsRecipientWallet,
			nftContractAddress,
			true
		)
		await eventTesting(setupAuctionResult.tx, testing, "OrderCreated", {
			auctionId: setupAuctionResult.auctionId,
			tokenId: tokenId,
			nftContractAddress: nftContractAddress,
			duration: duration,
			reservePrice: setupAuctionResult.reservePrice
		})
	});

	it('should emit event ApprovalForAll', async () => {
		let erc721V1AsSigner = await erc721V1.connect(wallet1);
		let setApprovalForAllResult = await erc721V1AsSigner.setApprovalForAll(transferProxy.address, true, { from: accounts1 })
		await eventTesting(setApprovalForAllResult, erc721V1, "ApprovalForAll", {
			owner: accounts1,
			operator: transferProxy.address,
			approved: true,
		})
	});

	it('should send ERC1155 asset to buyer with royalties', async () => {
		let erc1155TokenId1,
			bidAmount1,
			orderAmount

		let seller = accounts1
		let sellerWallet = wallet1
		let buyer = accounts2
		let buyerWallet = wallet2

		const {
			tokenId,
			duration,
			reservePrice,
			erc1155tokenAmount
		} = await setupAuctionDataERC1155()

		erc1155TokenId1 = tokenId
		const nftContractAddress = ghostERC1155.address
		console.log
		let result = await setupAuctionERC1155(
			tokenId,
			duration,
			//low reserve price, since that's not what we're testing
			BigNumber.from('1'),
			nftContractAddress
		)
		const auctionId = result.auctionId

		const royalties = await ghostERC1155.getRoyalties(erc1155TokenId1)
		console.log("ERC1155 royalties: ", royalties)

		bidAmount1 = 200
		//calculate final bid amount with royalties => (BP / 10000)
		orderAmount = bidAmount1 + bidAmount1 * (parseInt(royalties[0]['value']) / 10000)
		console.log("orderAmount: ", orderAmount)
		console.log("auctionId: ", auctionId)
		console.log("buyer: ", buyer)
		let buyerSigner = await testing.connect(buyerWallet);

		let tx = await buyerSigner.createBid(auctionId, orderAmount, false, { value: orderAmount, from: buyer });

		await mineTx(tx.hash);
		console.log("getCurrentBlockTime: ", await getCurrentBlockTime())

		await advanceTimeAndBlock(duration);
		console.log("getCurrentBlockTime: ", await getCurrentBlockTime())
		console.log("erc1155TokenId1: ", erc1155TokenId1)
		//console.log("erc1155TokenId1 owner address: ", await ghostERC1155._ownerOf(erc1155TokenId1))
		console.log("testing ERC1155 balance before: ", await ghostERC1155.balanceOf(testing.address, erc1155TokenId1))


		let erc1155AsSigner = await ghostERC1155.connect(sellerWallet);
		await erc1155AsSigner.setApprovalForAll(transferProxy.address, true, { from: seller });


		// Order: maker, makeAsset, taker, takeAsset, salt, start, end, dataType, data
		// Asset: assetClass, assetData, value
		const left = Order(buyer, Asset(ETH, "0x", bidAmount1), ZERO_ADDRESS, Asset(ERC1155, enc(ghostERC1155.address, erc1155TokenId1), 1), 1, 0, 0, NFT_TRANSFER_FROM_CONTRACT, "0x");
		const right = Order(seller, Asset(ERC1155, enc(ghostERC1155.address, erc1155TokenId1), 1), ZERO_ADDRESS, Asset(ETH, "0x", bidAmount1), 1, 0, 0, NFT_TRANSFER_FROM_CONTRACT, "0x");

		await verifyBalanceChange(buyer, -14, async () =>			//payed already while bidding to the auction contract
			verifyBalanceChange(seller, -180, async () =>				//matchAndTransferAuction(200 - 20)
				verifyBalanceChange(accounts3, -20, async () =>
					verifyBalanceChange(protocol, -6, () =>
						verifyBalanceChange(testing.address, 220, () =>
							buyerSigner.endAuctionDoTransfer(left, right, auctionId, { from: buyer, gasPrice: 0 })
						)
					)
				)
			)
		)

		console.log("testing balance: ", await web3.eth.getBalance(testing.address))
		console.log("testing ERC1155 balance: ", await ghostERC1155.balanceOf(testing.address, erc1155TokenId1))
		console.log("seller balance: ", await web3.eth.getBalance(seller))
		console.log("buyer balance: ", await web3.eth.getBalance(buyer))
		expect((await ghostERC1155.balanceOf(testing.address, erc1155TokenId1)).toString()).eq((erc1155tokenAmount - 1).toString());
		expect((await ghostERC1155.balanceOf(buyer, erc1155TokenId1)).toString()).eq('1');
	});

	async function setupAndCreateAuctionERC721(auctionType = RESERVE_AUCTION, returnTransaction = false, tokenAddress = ZERO_ADDRESS) {
		const {
			tokenId,
			duration,
			reservePrice,
			fundsRecipient,
			startingPrice,
			endingPrice,
			auctionStartDate,
			extensionPeriod
		} = await setupAuctionDataERC721()

		const nftContractAddress = erc721V1.address

		return await setupAuctionERC721(
			tokenId,
			duration,
			reservePrice,
			fundsRecipient,
			nftContractAddress,
			returnTransaction,
			auctionType,
			startingPrice,
			endingPrice,
			auctionStartDate,
			extensionPeriod,
			tokenAddress
		)
	}

	async function setupAuctionERC721(
		tokenId,
		duration,
		reservePrice,
		fundsRecipientWallet,
		nftContractAddress,
		returnTransaction = false,
		auctionType = RESERVE_AUCTION,
		startingPrice = ether('0.1').toString(),
		endingPrice = ether('0.01').toString(),
		auctionStartDate = 0,
		extensionPeriod = 0,
		currencyTokenContract = ZERO_ADDRESS,
		startAuctionNow = false
	) {
		console.log("tokenId: ", tokenId)
		console.log("duration: ", duration)
		console.log("reservePrice: ", reservePrice)
		console.log("nftContractAddress: ", nftContractAddress)
		console.log("auctionType: ", auctionType)

		//auction start date as unixtimestamp
		if (auctionStartDate == 0) {
			auctionStartDate = (Date.now() / 1000).toString().split('.')[0]
			console.log("auctionStartDate unixtimestamp", auctionStartDate)
			console.log("auctionStartDate converted to Date", new Date(auctionStartDate * 1000))
		}

		//get currentBlockTime as unix timestamp
		let currentBlockTime = await getCurrentBlockTime(false)
		if (auctionStartDate > currentBlockTime && startAuctionNow) {
			console.log("set auction StartDate to current BlockTime")
			auctionStartDate = currentBlockTime
			console.log("auctionStartDate set to currentBlockTime", currentBlockTime)
			console.log("auctionStartDate set to currentBlockTime, display as Date:", new Date(auctionStartDate * 1000))
		}

		let auctionCreatorSigner = await testing.connect(wallet1);
		let erc721Signer = await erc721V1.connect(wallet1);
		//set approval for the testing contract to transfer the nft to its address
		await erc721Signer.setApprovalForAll(testing.address, true, { from: accounts1 });

		let tx = await auctionCreatorSigner.createAuction(
			tokenId,
			duration,
			reservePrice,
			auctionType,
			startingPrice,
			endingPrice,
			auctionStartDate,
			extensionPeriod,
			[accounts0, nftContractAddress, currencyTokenContract],
			0,
			{ from: accounts1 }
		);

		const auctionId = await testing.getCurrentAuctionId()

		if (returnTransaction) {
			return {
				auctionId,
				tokenId,
				duration,
				reservePrice,
				fundsRecipientWallet,
				nftContractAddress,
				tx
			}
		} else {
			return {
				auctionId,
				tokenId,
				duration,
				reservePrice,
				nftContractAddress,
				auctionType,
				startingPrice,
				endingPrice,
				extensionPeriod
			}
		}

	}

	async function setupAuctionERC1155(
		tokenId,
		duration,
		reservePrice,
		nftContractAddress,
		auctionType = RESERVE_AUCTION,
		startingPrice = ether('0.1').toString(),
		endingPrice = ether('0.01').toString(),
		auctionStartDate = 0,
		extensionPeriod = 0,
		currencyTokenContract = ZERO_ADDRESS,
		erc1155tokenAmount = 10,
		startAuctionNow = false
	) {
		console.log("tokenId: ", tokenId)
		console.log("duration: ", duration)
		console.log("reservePrice: ", reservePrice)
		console.log("nftContractAddress: ", nftContractAddress)
		console.log("auctionType: ", auctionType)
		console.log("startingPrice: ", startingPrice)
		console.log("endingPrice: ", endingPrice)

		//auction start date as unixtimestamp
		if (auctionStartDate == 0) {
			auctionStartDate = (Date.now() / 1000).toString().split('.')[0]
		}
		console.log("auctionStartDate: ", new Date(auctionStartDate * 1000))

		//get currentBlockTime as unix timestamp
		let currentBlockTime = await getCurrentBlockTime(false)
		if (auctionStartDate > currentBlockTime && startAuctionNow) {
			console.log("adjust start date and start auction now")
			auctionStartDate = currentBlockTime
			console.log("auctionStartDate adjusted: ", new Date(auctionStartDate * 1000))
		}

		let auctionCreatorSigner = await testing.connect(wallet1);
		let erc1155Signer = await ghostERC1155.connect(wallet1);
		//set approval for the testing contract to transfer the nft to its address
		await erc1155Signer.setApprovalForAll(testing.address, true, { from: accounts1 });


		await auctionCreatorSigner.createAuction(
			tokenId,
			duration,
			reservePrice,
			auctionType,
			startingPrice,
			endingPrice,
			auctionStartDate,
			extensionPeriod,
			[accounts0, nftContractAddress, currencyTokenContract],
			erc1155tokenAmount,
			{ from: accounts1 }
		);

		const auctionId = await testing.getCurrentAuctionId()
		console.log("auctionId: ", auctionId)
		return {
			auctionId,
			tokenId,
			duration,
			reservePrice,
			nftContractAddress,
			auctionType,
			startingPrice,
			endingPrice,
			extensionPeriod
		}
	}

	async function setupAuctionDataERC1155() {
		const erc1155tokenAmount = 10
		await ghostERC1155.mintGhost(accounts1, erc1155tokenAmount, data, [[accounts3, 1000]], "ext_uri", "", "")
		const erc1155TokenId1 = await getLastTokenID(ghostERC1155)

		const tokenId = erc1155TokenId1.toNumber();
		const duration = 60 * 60 * 24; // 24 hours
		const reservePrice = ether('1').toString();

		const auctionStartDate = await getCurrentBlockTime(false)
		const extensionPeriod = 0

		return {
			tokenId,
			duration,
			reservePrice,
			erc1155tokenAmount,
			auctionStartDate,
			extensionPeriod
		};
	}

	async function setupAuctionDataERC721() {
		await erc721V1.mintGhost(accounts1, [[accounts3, 500], [accounts4, 1000]], "ext_uri", "", "")
		const erc721TokenId1 = await erc721V1.getLastTokenID()

		const tokenId = erc721TokenId1.toNumber()
		const duration = 60 * 60 * 24; // 24 hours
		const reservePrice = ether('1').toString()
		const fundsRecipientWallet = accounts3
		const startingPrice = ether('0.1').toString()
		const endingPrice = ether('0.01').toString()

		const auctionStartDate = await getCurrentBlockTime(false)
		const extensionPeriod = 0

		return {
			tokenId,
			duration,
			reservePrice,
			fundsRecipientWallet,
			startingPrice,
			endingPrice,
			auctionStartDate,
			extensionPeriod
		};
	}
});