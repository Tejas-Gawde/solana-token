"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaunchBundleService = void 0;
const web3_js_1 = require("@solana/web3.js");
const pump_sdk_1 = require("@pump-fun/pump-sdk");
const spl_token_1 = require("@solana/spl-token");
const bn_js_1 = __importDefault(require("bn.js"));
const uuid_1 = require("uuid");
const bs58_1 = __importDefault(require("bs58"));
const index_ts_1 = require("../../config/index.ts");
const errorHandler_ts_1 = require("../../middleware/errorHandler.ts");
const logger_ts_1 = require("../../utils/logger.ts");
const wallet_service_ts_1 = require("../wallet/wallet.service.ts");
const distribute_model_ts_1 = require("../distribute/distribute.model.ts");
const wallet_model_ts_1 = require("../wallet/wallet.model.ts");
const jito_service_ts_1 = require("./jito.service.ts");
const launch_bundle_model_ts_1 = require("./launch-bundle.model.ts");
const connection = new web3_js_1.Connection(index_ts_1.config.solana.rpcUrl, "confirmed");
function parsePublicKey(value, name) {
    try {
        return new web3_js_1.PublicKey(value);
    }
    catch {
        throw new errorHandler_ts_1.AppError(`Invalid public key: ${name}`, 400);
    }
}
function solToLamports(sol) {
    if (!Number.isFinite(sol) || sol <= 0) {
        throw new errorHandler_ts_1.AppError("Invalid SOL amount", 400);
    }
    const lamports = BigInt(Math.floor(sol * 1000000000));
    return new bn_js_1.default(lamports.toString());
}
function parseMintKeypairFromPrivateKey(privateKey) {
    if (!Array.isArray(privateKey) || privateKey.length !== 64) {
        throw new errorHandler_ts_1.AppError("mintPrivateKey must contain exactly 64 bytes", 400);
    }
    try {
        return web3_js_1.Keypair.fromSecretKey(Uint8Array.from(privateKey));
    }
    catch {
        throw new errorHandler_ts_1.AppError("Invalid mintPrivateKey", 400);
    }
}
class LaunchBundleService {
    static async launch(options) {
        const launchBundleId = (0, uuid_1.v4)();
        const { creatorPublicKey, userPublicKey, distributionId, name, symbol, uri, mintPrivateKey, mayhemMode = false, cashback = false, buyers, jitoTipSol = index_ts_1.config.jito.defaultTipSol, } = options;
        const resolvedDistributionId = distributionId?.trim() || "direct-wallets";
        launch_bundle_model_ts_1.LaunchBundleModel.create({
            launchBundleId,
            distributionId: resolvedDistributionId,
            creatorWallet: creatorPublicKey,
            userWallet: userPublicKey,
            requestPayload: options,
        });
        try {
            const creator = parsePublicKey(creatorPublicKey, "creatorPublicKey");
            const user = parsePublicKey(userPublicKey, "userPublicKey");
            const userKeypair = await wallet_service_ts_1.WalletService.getKeypairForWallet(userPublicKey);
            const mintKeypair = mintPrivateKey
                ? parseMintKeypairFromPrivateKey(mintPrivateKey)
                : web3_js_1.Keypair.generate();
            if (distributionId?.trim()) {
                await this.validateBuyerWalletsFromDistribution(distributionId, buyers);
            }
            else {
                this.validateDuplicateBuyerWallets(buyers);
            }
            const buyerSigners = await this.loadBuyerSigners(buyers);
            await this.preflightBalances(user, buyerSigners, buyers, jitoTipSol);
            const lookupAddresses = this.collectLookupAddresses({
                creator,
                user,
                mint: mintKeypair.publicKey,
                buyers,
            });
            const lutInfo = await this.createAndExtendLookupTable(userKeypair, lookupAddresses);
            const lutAccount = await this.fetchLookupTableOrThrow(lutInfo.lutAddress);
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            const launchInstructions = [
                web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
                web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({
                    microLamports: index_ts_1.config.jito.computeUnitPriceMicroLamports,
                }),
                await pump_sdk_1.PUMP_SDK.createV2Instruction({
                    mint: mintKeypair.publicKey,
                    name,
                    symbol,
                    uri,
                    creator,
                    user,
                    mayhemMode,
                    cashback,
                }),
            ];
            const launchMessage = new web3_js_1.TransactionMessage({
                payerKey: user,
                recentBlockhash: blockhash,
                instructions: launchInstructions,
            }).compileToV0Message([lutAccount]);
            const launchTx = new web3_js_1.VersionedTransaction(launchMessage);
            launchTx.sign([userKeypair, mintKeypair]);
            const onlinePumpSdk = new pump_sdk_1.OnlinePumpSdk(connection);
            const global = await onlinePumpSdk.fetchGlobal();
            const feeConfig = await onlinePumpSdk.fetchFeeConfig();
            const buyerTransactions = [];
            for (let i = 0; i < buyers.length; i++) {
                const buyer = buyers[i];
                const buyerSigner = buyerSigners[i];
                const buyerPubkey = parsePublicKey(buyer.walletPublicKey, "buyer wallet");
                const solAmount = solToLamports(buyer.buySolAmount);
                const amount = (0, pump_sdk_1.getBuyTokenAmountFromSolAmount)({
                    global,
                    feeConfig,
                    mintSupply: null,
                    bondingCurve: null,
                    amount: solAmount,
                });
                const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } = await onlinePumpSdk.fetchBuyState(mintKeypair.publicKey, buyerPubkey, spl_token_1.TOKEN_2022_PROGRAM_ID);
                const buyInstructions = await pump_sdk_1.PUMP_SDK.buyInstructions({
                    global,
                    bondingCurveAccountInfo,
                    associatedUserAccountInfo,
                    bondingCurve,
                    mint: mintKeypair.publicKey,
                    user: buyerPubkey,
                    amount,
                    solAmount,
                    slippage: buyer.slippage ?? 1,
                    tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
                });
                const buyerMessage = new web3_js_1.TransactionMessage({
                    payerKey: buyerPubkey,
                    recentBlockhash: blockhash,
                    instructions: [
                        web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 }),
                        web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({
                            microLamports: index_ts_1.config.jito.computeUnitPriceMicroLamports,
                        }),
                        ...buyInstructions,
                    ],
                }).compileToV0Message([lutAccount]);
                const buyerTx = new web3_js_1.VersionedTransaction(buyerMessage);
                buyerTx.sign([buyerSigner]);
                buyerTransactions.push(buyerTx);
            }
            const tipAccount = parsePublicKey(await jito_service_ts_1.JitoService.getTipAccount(), "jitoTip");
            const tipLamports = Number(solToLamports(jitoTipSol).toString());
            const tipMessage = new web3_js_1.TransactionMessage({
                payerKey: user,
                recentBlockhash: blockhash,
                instructions: [
                    web3_js_1.SystemProgram.transfer({
                        fromPubkey: user,
                        toPubkey: tipAccount,
                        lamports: tipLamports,
                    }),
                ],
            }).compileToV0Message([lutAccount]);
            const tipTx = new web3_js_1.VersionedTransaction(tipMessage);
            tipTx.sign([userKeypair]);
            const bundleTransactions = [launchTx, ...buyerTransactions, tipTx];
            const bundleId = await jito_service_ts_1.JitoService.sendBundle(bundleTransactions);
            const bundleStatus = await jito_service_ts_1.JitoService.waitForBundleFinalStatus(bundleId);
            const result = {
                launchBundleId,
                bundleId,
                mintAddress: mintKeypair.publicKey.toBase58(),
                lookupTableAddress: lutInfo.lutAddress.toBase58(),
                createLutSignature: lutInfo.createSignature,
                extendLutSignatures: lutInfo.extendSignatures,
                launchTxSignature: this.getFirstSignature(launchTx),
                buyerTxSignatures: buyerTransactions.map((tx) => this.getFirstSignature(tx)),
                tipTxSignature: this.getFirstSignature(tipTx),
                buyerWallets: buyers.map((buyer) => buyer.walletPublicKey),
                status: bundleStatus,
            };
            launch_bundle_model_ts_1.LaunchBundleModel.updateSuccess(launchBundleId, {
                bundleId: result.bundleId,
                mintAddress: result.mintAddress,
                lookupTableAddress: result.lookupTableAddress,
                createLutSignature: result.createLutSignature,
                extendLutSignatures: result.extendLutSignatures,
                launchTxSignature: result.launchTxSignature,
                buyerTxSignatures: result.buyerTxSignatures,
                tipTxSignature: result.tipTxSignature,
                status: result.status,
            });
            return result;
        }
        catch (error) {
            launch_bundle_model_ts_1.LaunchBundleModel.updateFailure(launchBundleId, error?.message || "Unknown launch bundle error");
            logger_ts_1.logger.error(`Launch bundle failed (${launchBundleId}): ${error?.message}`);
            if (error instanceof errorHandler_ts_1.AppError)
                throw error;
            throw new errorHandler_ts_1.AppError(`Launch bundle failed: ${error?.message || error}`, 500);
        }
    }
    static async getLaunchBundle(launchBundleId) {
        const launchBundle = launch_bundle_model_ts_1.LaunchBundleModel.findByLaunchBundleId(launchBundleId);
        if (!launchBundle) {
            throw new errorHandler_ts_1.AppError(`Launch bundle not found: ${launchBundleId}`, 404);
        }
        return launchBundle;
    }
    static async validateBuyerWalletsFromDistribution(distributionId, buyers) {
        const distribution = distribute_model_ts_1.DistributeModel.findByDistributionId(distributionId);
        if (!distribution) {
            throw new errorHandler_ts_1.AppError(`Distribution not found: ${distributionId}`, 404);
        }
        const allowedWallets = new Set(wallet_model_ts_1.WalletModel.getPublicKeysByGroup(distribution.c_wallets_group_tag));
        if (allowedWallets.size === 0) {
            throw new errorHandler_ts_1.AppError(`No C wallets found for distribution ${distributionId}`, 404);
        }
        const seen = new Set();
        for (const buyer of buyers) {
            if (!allowedWallets.has(buyer.walletPublicKey)) {
                throw new errorHandler_ts_1.AppError(`Buyer wallet ${buyer.walletPublicKey} is not in distribution C-wallet group`, 400);
            }
            if (seen.has(buyer.walletPublicKey)) {
                throw new errorHandler_ts_1.AppError(`Duplicate buyer wallet in request: ${buyer.walletPublicKey}`, 400);
            }
            seen.add(buyer.walletPublicKey);
        }
    }
    static validateDuplicateBuyerWallets(buyers) {
        const seen = new Set();
        for (const buyer of buyers) {
            if (seen.has(buyer.walletPublicKey)) {
                throw new errorHandler_ts_1.AppError(`Duplicate buyer wallet in request: ${buyer.walletPublicKey}`, 400);
            }
            seen.add(buyer.walletPublicKey);
        }
    }
    static async loadBuyerSigners(buyers) {
        return Promise.all(buyers.map((buyer) => wallet_service_ts_1.WalletService.getKeypairForWallet(buyer.walletPublicKey)));
    }
    static async preflightBalances(user, buyerSigners, buyers, jitoTipSol) {
        const userBalance = await connection.getBalance(user, "confirmed");
        const neededForUser = Number(solToLamports(jitoTipSol).toString()) + 2000000;
        if (userBalance < neededForUser) {
            throw new errorHandler_ts_1.AppError(`Insufficient user wallet balance for LUT txs + tip. Have ${userBalance}, need at least ${neededForUser} lamports`, 400);
        }
        for (let i = 0; i < buyers.length; i++) {
            const buyerBalance = await connection.getBalance(buyerSigners[i].publicKey, "confirmed");
            const buyLamports = Number(solToLamports(buyers[i].buySolAmount).toString());
            const needed = buyLamports + 1000000;
            if (buyerBalance < needed) {
                throw new errorHandler_ts_1.AppError(`Insufficient balance in buyer wallet ${buyers[i].walletPublicKey}. Have ${buyerBalance}, need at least ${needed} lamports`, 400);
            }
        }
    }
    static collectLookupAddresses(input) {
        const keys = new Map();
        const addKey = (key) => keys.set(key.toBase58(), key);
        addKey(input.creator);
        addKey(input.user);
        addKey(input.mint);
        addKey(web3_js_1.SystemProgram.programId);
        addKey(web3_js_1.ComputeBudgetProgram.programId);
        for (const buyer of input.buyers) {
            addKey(parsePublicKey(buyer.walletPublicKey, "buyer wallet"));
        }
        return [...keys.values()];
    }
    static async createAndExtendLookupTable(authority, addresses) {
        let lutAddress = null;
        let createSignature = "";
        let lastError;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                // LUT creation is sensitive to slot staleness; use finalized slot and retry.
                const recentSlot = await connection.getSlot("finalized");
                const [createIx, candidateLutAddress] = web3_js_1.AddressLookupTableProgram.createLookupTable({
                    authority: authority.publicKey,
                    payer: authority.publicKey,
                    recentSlot,
                });
                createSignature = await this.sendSingleInstructionTransaction([createIx], authority.publicKey, [authority]);
                lutAddress = candidateLutAddress;
                break;
            }
            catch (error) {
                lastError = error;
                if (attempt < 3) {
                    await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
                }
            }
        }
        if (!lutAddress) {
            const message = lastError instanceof Error ? lastError.message : "unknown LUT creation error";
            throw new errorHandler_ts_1.AppError(`Failed to create lookup table: ${message}`, 500);
        }
        const extendSignatures = [];
        // Keep LUT extend chunks conservative to avoid instruction-data overflow.
        const chunkSize = 10;
        for (let i = 0; i < addresses.length; i += chunkSize) {
            const chunk = addresses.slice(i, i + chunkSize);
            const extendIx = web3_js_1.AddressLookupTableProgram.extendLookupTable({
                payer: authority.publicKey,
                authority: authority.publicKey,
                lookupTable: lutAddress,
                addresses: chunk,
            });
            const sig = await this.sendSingleInstructionTransaction([extendIx], authority.publicKey, [authority]);
            extendSignatures.push(sig);
        }
        return { lutAddress, createSignature, extendSignatures };
    }
    static async fetchLookupTableOrThrow(lutAddress) {
        const result = await connection.getAddressLookupTable(lutAddress);
        if (!result.value) {
            throw new errorHandler_ts_1.AppError(`Failed to fetch lookup table account ${lutAddress.toBase58()}`, 500);
        }
        return result.value;
    }
    static async sendSingleInstructionTransaction(instructions, payer, signers) {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        const msg = new web3_js_1.TransactionMessage({
            payerKey: payer,
            recentBlockhash: blockhash,
            instructions,
        }).compileToV0Message();
        const tx = new web3_js_1.VersionedTransaction(msg);
        tx.sign(signers);
        const sig = await connection.sendTransaction(tx, {
            skipPreflight: false,
            maxRetries: 3,
        });
        const confirmation = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
        if (confirmation.value.err) {
            throw new errorHandler_ts_1.AppError(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`, 500);
        }
        return sig;
    }
    static getFirstSignature(transaction) {
        if (!transaction.signatures[0]) {
            throw new errorHandler_ts_1.AppError("Transaction has no signature", 500);
        }
        return bs58_1.default.encode(transaction.signatures[0]);
    }
}
exports.LaunchBundleService = LaunchBundleService;
