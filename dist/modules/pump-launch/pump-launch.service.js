"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PumpLaunchService = void 0;
const web3_js_1 = require("@solana/web3.js");
const bn_js_1 = __importDefault(require("bn.js"));
const pump_sdk_1 = require("@pump-fun/pump-sdk");
const spl_token_1 = require("@solana/spl-token");
const wallet_service_1 = require("../wallet/wallet.service");
const index_1 = require("../../config/index");
const errorHandler_ts_1 = require("../../middleware/errorHandler.ts");
const connection = new web3_js_1.Connection(index_1.config.solana.rpcUrl, "confirmed");
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
function serializeValue(value) {
    if (value instanceof bn_js_1.default)
        return value.toString();
    if (value instanceof web3_js_1.PublicKey)
        return value.toBase58();
    if (value instanceof Uint8Array)
        return Buffer.from(value).toString("base64");
    if (value instanceof ArrayBuffer)
        return Buffer.from(new Uint8Array(value)).toString("base64");
    if (Array.isArray(value))
        return value.map(serializeValue);
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [
            k,
            serializeValue(v),
        ]));
    }
    return value;
}
class PumpLaunchService {
    static async launchToken(options) {
        const { creatorPublicKey, userPublicKey, name, symbol, uri, mintPrivateKey, mayhemMode = false, cashback = false, initialBuySol, slippage = 1, } = options;
        const creator = parsePublicKey(creatorPublicKey, "creatorPublicKey");
        const user = parsePublicKey(userPublicKey, "userPublicKey");
        const userKeypair = await wallet_service_1.WalletService.getKeypairForWallet(userPublicKey);
        const mintKeypair = mintPrivateKey
            ? parseMintKeypairFromPrivateKey(mintPrivateKey)
            : web3_js_1.Keypair.generate();
        const instructions = [];
        let result = {
            action: "created",
            mintAddress: mintKeypair.publicKey.toBase58(),
            txSignature: "",
        };
        if (typeof initialBuySol === "number" && initialBuySol > 0) {
            // For token creation with initial buy, we split into two transactions to avoid size limits:
            // 1. Create the token
            // 2. Buy from the bonding curve (using fresh state after creation)
            const onlinePumpSdk = new pump_sdk_1.OnlinePumpSdk(connection);
            // Step 1: Create the token
            const createInstructions = await pump_sdk_1.PUMP_SDK.createV2Instruction({
                mint: mintKeypair.publicKey,
                name,
                symbol,
                uri,
                creator,
                user,
                mayhemMode,
                cashback,
            });
            const createTxSignature = await this.sendTransaction([createInstructions], [userKeypair, mintKeypair], user);
            // Step 2: Buy from the bonding curve
            // Fetch fresh state after token creation
            const tokenProgram = await this.detectTokenProgram(mintKeypair.publicKey);
            const globalAfterCreate = await onlinePumpSdk.fetchGlobal();
            const feeConfigAfterCreate = await onlinePumpSdk.fetchFeeConfig();
            const initialBuyLamports = solToLamports(initialBuySol);
            const amount = (0, pump_sdk_1.getBuyTokenAmountFromSolAmount)({
                global: globalAfterCreate,
                feeConfig: feeConfigAfterCreate,
                mintSupply: null,
                bondingCurve: null,
                amount: initialBuyLamports,
            });
            // Get bonding curve state after creation
            const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } = await onlinePumpSdk.fetchBuyState(mintKeypair.publicKey, user, tokenProgram);
            const buyInstructions = await pump_sdk_1.PUMP_SDK.buyInstructions({
                global: globalAfterCreate,
                bondingCurveAccountInfo,
                associatedUserAccountInfo,
                bondingCurve,
                mint: mintKeypair.publicKey,
                user,
                amount,
                solAmount: initialBuyLamports,
                slippage: slippage,
                tokenProgram,
            });
            const buyTxSignature = await this.sendTransaction(buyInstructions, [userKeypair], user);
            return {
                action: "created_with_buy",
                mintAddress: mintKeypair.publicKey.toBase58(),
                txSignature: buyTxSignature, // Return the buy transaction signature
                purchasedTokenAmountRaw: amount.toString(),
                spentSolLamports: initialBuyLamports.toString(),
            };
        }
        instructions.push(await pump_sdk_1.PUMP_SDK.createV2Instruction({
            mint: mintKeypair.publicKey,
            name,
            symbol,
            uri,
            creator,
            user,
            mayhemMode,
            cashback,
        }));
        const txSignature = await this.sendTransaction(instructions, [userKeypair, mintKeypair], user);
        result.txSignature = txSignature;
        return result;
    }
    static async buyFromBondingCurve(options) {
        const { mintAddress, userPublicKey, buySolAmount, buyTokenAmountRaw, slippage = 1, } = options;
        const user = parsePublicKey(userPublicKey, "userPublicKey");
        const mint = parsePublicKey(mintAddress, "mintAddress");
        const tokenProgram = await this.detectTokenProgram(mint);
        const userKeypair = await wallet_service_1.WalletService.getKeypairForWallet(userPublicKey);
        const onlinePumpSdk = new pump_sdk_1.OnlinePumpSdk(connection);
        const global = await onlinePumpSdk.fetchGlobal();
        const feeConfig = await onlinePumpSdk.fetchFeeConfig();
        const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } = await onlinePumpSdk.fetchBuyState(mint, user, tokenProgram);
        const mintSupply = await this.getMintSupply(mint);
        let amount;
        let solAmount;
        if (typeof buySolAmount === "number") {
            solAmount = solToLamports(buySolAmount);
            amount = (0, pump_sdk_1.getBuyTokenAmountFromSolAmount)({
                global,
                feeConfig,
                mintSupply,
                bondingCurve,
                amount: solAmount,
            });
        }
        else if (buyTokenAmountRaw) {
            amount = new bn_js_1.default(buyTokenAmountRaw);
            solAmount = (0, pump_sdk_1.getBuySolAmountFromTokenAmount)({
                global,
                feeConfig,
                mintSupply,
                bondingCurve,
                amount,
            });
        }
        else {
            throw new errorHandler_ts_1.AppError("Either buySolAmount or buyTokenAmountRaw must be provided", 400);
        }
        const instructions = await pump_sdk_1.PUMP_SDK.buyInstructions({
            global,
            bondingCurveAccountInfo,
            associatedUserAccountInfo,
            bondingCurve,
            mint,
            user,
            amount,
            solAmount,
            slippage,
            tokenProgram,
        });
        const txSignature = await this.sendTransaction(instructions, [userKeypair], user);
        return {
            mintAddress,
            txSignature,
            purchasedTokenAmountRaw: amount.toString(),
            spentSolLamports: solAmount.toString(),
            slippageBps: slippage,
        };
    }
    static async migrateBondingCurve(options) {
        const { mintAddress, userPublicKey } = options;
        const user = parsePublicKey(userPublicKey, "userPublicKey");
        const mint = parsePublicKey(mintAddress, "mintAddress");
        const tokenProgram = await this.detectTokenProgram(mint);
        const userKeypair = await wallet_service_1.WalletService.getKeypairForWallet(userPublicKey);
        const onlinePumpSdk = new pump_sdk_1.OnlinePumpSdk(connection);
        const global = await onlinePumpSdk.fetchGlobal();
        if (!global.enableMigrate) {
            throw new errorHandler_ts_1.AppError("Pump migrations are disabled for this network", 400);
        }
        const instructions = [
            await pump_sdk_1.PUMP_SDK.migrateInstruction({
                withdrawAuthority: global.withdrawAuthority,
                mint,
                user,
                tokenProgram,
            }),
        ];
        const txSignature = await this.sendTransaction(instructions, [userKeypair], user);
        return { mintAddress, txSignature };
    }
    static async getBondingCurveInfo(mintAddress) {
        const mint = parsePublicKey(mintAddress, "mintAddress");
        const tokenProgram = await this.detectTokenProgram(mint);
        const onlinePumpSdk = new pump_sdk_1.OnlinePumpSdk(connection);
        const global = await onlinePumpSdk.fetchGlobal();
        const feeConfig = await onlinePumpSdk.fetchFeeConfig();
        const bondingCurve = await onlinePumpSdk.fetchBondingCurve(mint);
        const mintSupply = await this.getMintSupply(mint);
        return {
            mintAddress,
            tokenProgram: tokenProgram.toBase58(),
            mintSupply: mintSupply.toString(),
            global: serializeValue(global),
            feeConfig: serializeValue(feeConfig),
            bondingCurve: serializeValue(bondingCurve),
        };
    }
    static async detectTokenProgram(mint) {
        const accountInfo = await connection.getAccountInfo(mint, "finalized");
        if (!accountInfo) {
            throw new errorHandler_ts_1.AppError(`Mint account not found: ${mint.toBase58()}`, 404);
        }
        if (accountInfo.owner.equals(spl_token_1.TOKEN_2022_PROGRAM_ID))
            return spl_token_1.TOKEN_2022_PROGRAM_ID;
        if (accountInfo.owner.equals(spl_token_1.TOKEN_PROGRAM_ID))
            return spl_token_1.TOKEN_PROGRAM_ID;
        throw new errorHandler_ts_1.AppError(`Unsupported token program for mint ${mint.toBase58()}`, 400);
    }
    static async getMintSupply(mint) {
        const supply = await connection.getTokenSupply(mint);
        return new bn_js_1.default(supply.value.amount);
    }
    static async sendTransaction(instructions, signers, feePayer) {
        if (instructions.length === 0) {
            throw new errorHandler_ts_1.AppError("No instructions to send", 400);
        }
        // Try to send as a single transaction first
        try {
            return await this.sendTransactionSingle(instructions, signers, feePayer);
        }
        catch (error) {
            // Check if it's a transaction size error
            if (error.message?.includes("too large") ||
                error.message?.includes("Transaction too large") ||
                error.message?.includes("base64 encoded solana_transaction")) {
                // If single transaction fails due to size, try splitting
                return await this.sendTransactionSplit(instructions, signers, feePayer);
            }
            // Handle transaction simulation errors specifically
            if (error.message?.includes("Simulation failed") && error.getLogs) {
                try {
                    const logs = await error.getLogs();
                    console.error("Transaction simulation logs:", logs);
                    throw new errorHandler_ts_1.AppError(`Transaction simulation failed: ${error.message}. Logs: ${JSON.stringify(logs)}`, 500);
                }
                catch (logError) {
                    // If getting logs fails, still throw the original error with additional context
                    throw new errorHandler_ts_1.AppError(`Transaction simulation failed: ${error.message}. Failed to retrieve logs: ${logError.message}`, 500);
                }
            }
            throw error;
        }
    }
    static async sendTransactionSingle(instructions, signers, feePayer) {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        const messageV0 = new web3_js_1.TransactionMessage({
            payerKey: feePayer,
            recentBlockhash: blockhash,
            instructions,
        }).compileToV0Message();
        const versionedTx = new web3_js_1.VersionedTransaction(messageV0);
        versionedTx.sign(signers);
        const txSignature = await connection.sendTransaction(versionedTx, {
            skipPreflight: false,
            maxRetries: 3,
        });
        await this.awaitConfirmation(txSignature, blockhash, lastValidBlockHeight);
        return txSignature;
    }
    static async sendTransactionSplit(instructions, signers, feePayer) {
        // For pump launch with buy, we'll split into:
        // 1. Token creation transaction
        // 2. Buy transaction
        // This is a simplified approach - in practice, you'd need to determine
        // which instructions belong to which transaction based on your SDK
        // For now, we'll implement a basic split heuristic:
        // If we have more than 5 instructions, split roughly in half
        if (instructions.length <= 5) {
            // If it's still small but failing, rethrow the original error
            throw new errorHandler_ts_1.AppError("Transaction too large but cannot split further", 500);
        }
        const midPoint = Math.floor(instructions.length / 2);
        const firstBatch = instructions.slice(0, midPoint);
        const secondBatch = instructions.slice(midPoint);
        // For pump launch, the first batch is likely token creation
        // and second batch is the buy operation
        try {
            // Send first transaction (token creation)
            const firstSignature = await this.sendTransactionSingle(firstBatch, signers, // All signers needed for first batch
            feePayer);
            // Send second transaction (buy)
            // Using all signers for safety (both transactions likely need the same signers)
            const secondSignature = await this.sendTransactionSingle(secondBatch, signers, // All signers needed for second batch
            feePayer);
            // Return the last transaction signature (the buy)
            // In a real implementation, you might want to return both or handle differently
            return secondSignature;
        }
        catch (splitError) {
            // If splitting also fails, throw an informative error
            throw new errorHandler_ts_1.AppError(`Failed to send transaction even after splitting: ${splitError.message}. Original transaction had ${instructions.length} instructions.`, 500);
        }
    }
    static async awaitConfirmation(signature, blockhash, lastValidBlockHeight) {
        const result = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
        if (result.value.err) {
            throw new errorHandler_ts_1.AppError(`Transaction failed on-chain: ${JSON.stringify(result.value.err)}`, 500);
        }
    }
}
exports.PumpLaunchService = PumpLaunchService;
