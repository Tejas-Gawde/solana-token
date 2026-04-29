"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DistributeService = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const uuid_1 = require("uuid");
const bs58_1 = __importDefault(require("bs58"));
const index_ts_1 = require("../../config/index.ts");
const logger_ts_1 = require("../../utils/logger.ts");
const errorHandler_ts_1 = require("../../middleware/errorHandler.ts");
const wallet_model_ts_1 = require("../wallet/wallet.model.ts");
const crypto_ts_1 = require("../../utils/crypto.ts");
const distribute_model_ts_1 = require("./distribute.model.ts");
const connection = new web3_js_1.Connection(index_ts_1.config.solana.rpcUrl, "confirmed");
const MAX_RETRIES = 5;
const BATCH_SIZE = 4;
function toPublicInfo(record) {
    let step2Sigs = [];
    try {
        if (record.step2_tx_signatures) {
            step2Sigs = JSON.parse(record.step2_tx_signatures);
        }
    }
    catch { }
    return {
        id: record.id,
        distributionId: record.distribution_id,
        mainWallet: record.main_wallet,
        numWallets: record.num_wallets,
        solPerWallet: record.sol_per_wallet,
        totalSol: record.total_sol,
        step1TxSignature: record.step1_tx_signature,
        step2TxSignatures: step2Sigs,
        bWalletsGroupTag: record.b_wallets_group_tag,
        cWalletsGroupTag: record.c_wallets_group_tag,
        status: record.status,
        groupTag: record.group_tag,
        createdAt: record.created_at,
    };
}
/**
 * Get a legacy Keypair from a stored wallet
 */
function getKeypairFromWallet(publicKey) {
    const record = wallet_model_ts_1.WalletModel.findByPublicKey(publicKey);
    if (!record) {
        throw new errorHandler_ts_1.AppError(`Wallet not found: ${publicKey}`, 404);
    }
    const privateKeyBase58 = (0, crypto_ts_1.decryptPrivateKey)(record.encrypted_private_key);
    const secretKeyBytes = bs58_1.default.decode(privateKeyBase58);
    if (secretKeyBytes.length !== 64) {
        throw new errorHandler_ts_1.AppError("Stored key is corrupted", 500);
    }
    return web3_js_1.Keypair.fromSecretKey(secretKeyBytes);
}
/**
 * Send and confirm a versioned transaction with retries
 */
async function sendAndConfirmWithRetry(transaction, label) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const signature = await connection.sendRawTransaction(transaction.serialize(), {
                skipPreflight: false,
                maxRetries: 3,
            });
            logger_ts_1.logger.info(`${label} — tx sent: ${signature} (attempt ${attempt})`);
            const latestBlockhash = await connection.getLatestBlockhash();
            const confirmation = await connection.confirmTransaction({
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            }, "confirmed");
            if (confirmation.value.err) {
                throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
            }
            logger_ts_1.logger.info(`${label} — confirmed: ${signature}`);
            return signature;
        }
        catch (error) {
            logger_ts_1.logger.warn(`${label} — attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);
            if (attempt === MAX_RETRIES) {
                throw new errorHandler_ts_1.AppError(`${label} failed after ${MAX_RETRIES} attempts: ${error.message}`, 500);
            }
            await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        }
    }
    throw new errorHandler_ts_1.AppError("Should not reach here", 500);
}
/**
 * Store a C wallet (buyer/destination) into the main wallets table
 */
function storeCWalletInMainTable(keypair, groupTag) {
    const publicKey = keypair.publicKey.toBase58();
    const secretKeyBase58 = bs58_1.default.encode(keypair.secretKey);
    const encryptedPrivateKey = (0, crypto_ts_1.encryptPrivateKey)(secretKeyBase58);
    const existing = wallet_model_ts_1.WalletModel.findByPublicKey(publicKey);
    if (!existing) {
        wallet_model_ts_1.WalletModel.create({
            publicKey,
            encryptedPrivateKey,
            groupTag,
        });
    }
    return publicKey;
}
class DistributeService {
    /**
     * Distribute SOL from main wallet to C wallets via B intermediary wallets
     *
     * Flow:
     * Step 1: Main → B wallets (direct SOL transfer)
     * Step 2: B wallets → create wSOL ATA → wrap SOL → close ATA to C wallets
     * Result: C wallets receive SOL with no direct on-chain link to Main
     *
     * B wallets are stored in wallets_temp_distribute (not the main wallets table)
     * C wallets are stored in the main wallets table (ready for use)
     */
    static async distribute(options) {
        const { mainWalletPublicKey, numWallets, solPerWallet, groupTag } = options;
        const distributionId = (0, uuid_1.v4)();
        const bGroupTag = `${groupTag}-dist`;
        const cGroupTag = `${groupTag}-dist`;
        try {
            // Validate main wallet
            const mainKp = getKeypairFromWallet(mainWalletPublicKey);
            // Check balance
            const mainBalance = await connection.getBalance(mainKp.publicKey);
            const solAmountPerWallet = Math.floor((solPerWallet + 0.01) * web3_js_1.LAMPORTS_PER_SOL);
            const totalNeeded = solAmountPerWallet * numWallets + 0.01 * web3_js_1.LAMPORTS_PER_SOL;
            if (mainBalance < totalNeeded) {
                throw new errorHandler_ts_1.AppError(`Insufficient balance. Main wallet has ${(mainBalance / web3_js_1.LAMPORTS_PER_SOL).toFixed(4)} SOL, ` +
                    `needs ~${(totalNeeded / web3_js_1.LAMPORTS_PER_SOL).toFixed(4)} SOL ` +
                    `(${numWallets} × ${solPerWallet} SOL + fees)`, 400);
            }
            logger_ts_1.logger.info(`Starting distribution: ${mainWalletPublicKey} → ${numWallets} wallets × ${solPerWallet} SOL`);
            // Generate B (temp) and C (buyer) keypairs
            const bWallets = [];
            const cWallets = [];
            for (let i = 0; i < numWallets; i++) {
                bWallets.push(web3_js_1.Keypair.generate());
                cWallets.push(web3_js_1.Keypair.generate());
            }
            // Store B wallets in temp table (batch insert)
            const bTempData = bWallets.map((kp, index) => ({
                publicKey: kp.publicKey.toBase58(),
                encryptedPrivateKey: (0, crypto_ts_1.encryptPrivateKey)(bs58_1.default.encode(kp.secretKey)),
                distributionId,
                walletIndex: index,
            }));
            distribute_model_ts_1.DistributeModel.createTempWalletsBatch(bTempData);
            logger_ts_1.logger.info(`${numWallets} B wallets stored in temp table`);
            // Store C wallets in main wallets table
            const cPublicKeys = [];
            for (let i = 0; i < numWallets; i++) {
                cPublicKeys.push(storeCWalletInMainTable(cWallets[i], cGroupTag));
            }
            logger_ts_1.logger.info(`${numWallets} C wallets stored in main wallets table [group: ${cGroupTag}]`);
            const bPublicKeys = bWallets.map((kp) => kp.publicKey.toBase58());
            const totalSol = solPerWallet * numWallets;
            // Create distribution record
            const record = distribute_model_ts_1.DistributeModel.create({
                distributionId,
                mainWallet: mainWalletPublicKey,
                numWallets,
                solPerWallet,
                totalSol,
                bWalletsGroupTag: bGroupTag,
                cWalletsGroupTag: cGroupTag,
                groupTag,
            });
            // ====== STEP 1: Main → B wallets ======
            logger_ts_1.logger.info("Step 1: Main → B wallets (transfer SOL)...");
            const step1Ixs = [
                web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({ units: 1000000 }),
                web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 250000 }),
            ];
            for (let i = 0; i < numWallets; i++) {
                step1Ixs.push(web3_js_1.SystemProgram.transfer({
                    fromPubkey: mainKp.publicKey,
                    toPubkey: bWallets[i].publicKey,
                    lamports: solAmountPerWallet,
                }));
            }
            const step1Blockhash = await connection.getLatestBlockhash();
            const step1Message = new web3_js_1.TransactionMessage({
                payerKey: mainKp.publicKey,
                recentBlockhash: step1Blockhash.blockhash,
                instructions: step1Ixs,
            }).compileToV0Message();
            const step1Tx = new web3_js_1.VersionedTransaction(step1Message);
            step1Tx.sign([mainKp]);
            const step1Sig = await sendAndConfirmWithRetry(step1Tx, "Step 1 (Main → B)");
            distribute_model_ts_1.DistributeModel.updateStep1(distributionId, step1Sig);
            logger_ts_1.logger.info(`Step 1 complete: ${step1Sig}`);
            await new Promise((resolve) => setTimeout(resolve, 3000));
            // ====== STEP 2: B wallets → wSOL wrap → close to C wallets ======
            logger_ts_1.logger.info("Step 2: B wallets → wSOL wrap → close to C wallets...");
            const step2Signatures = [];
            const totalBatches = Math.ceil(numWallets / BATCH_SIZE);
            for (let batch = 0; batch < totalBatches; batch++) {
                const batchStart = batch * BATCH_SIZE;
                const batchEnd = Math.min(batchStart + BATCH_SIZE, numWallets);
                const batchIxs = [
                    web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({ units: 1000000 }),
                    web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 250000 }),
                ];
                const batchSigners = [mainKp];
                for (let i = batchStart; i < batchEnd; i++) {
                    const bWallet = bWallets[i];
                    const cWallet = cWallets[i];
                    const wsolAta = (0, spl_token_1.getAssociatedTokenAddressSync)(spl_token_1.NATIVE_MINT, bWallet.publicKey);
                    // 1. Create wSOL ATA for B (main pays rent)
                    batchIxs.push((0, spl_token_1.createAssociatedTokenAccountInstruction)(mainKp.publicKey, wsolAta, bWallet.publicKey, spl_token_1.NATIVE_MINT));
                    // 2. B transfers ALL SOL to wSOL ATA
                    batchIxs.push(web3_js_1.SystemProgram.transfer({
                        fromPubkey: bWallet.publicKey,
                        toPubkey: wsolAta,
                        lamports: solAmountPerWallet,
                    }));
                    // 3. Sync native SOL in ATA
                    batchIxs.push((0, spl_token_1.createSyncNativeInstruction)(wsolAta));
                    // 4. Close wSOL ATA → C wallet receives SOL
                    batchIxs.push((0, spl_token_1.createCloseAccountInstruction)(wsolAta, cWallet.publicKey, bWallet.publicKey));
                    batchSigners.push(bWallet);
                }
                const batchBlockhash = await connection.getLatestBlockhash();
                const batchMessage = new web3_js_1.TransactionMessage({
                    payerKey: mainKp.publicKey,
                    recentBlockhash: batchBlockhash.blockhash,
                    instructions: batchIxs,
                }).compileToV0Message();
                const batchTx = new web3_js_1.VersionedTransaction(batchMessage);
                batchTx.sign(batchSigners);
                const batchSig = await sendAndConfirmWithRetry(batchTx, `Step 2 batch ${batch + 1}/${totalBatches}`);
                step2Signatures.push(batchSig);
                logger_ts_1.logger.info(`Step 2 batch ${batch + 1}/${totalBatches} complete: ${batchSig}`);
                if (batch < totalBatches - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                }
            }
            // Update DB
            distribute_model_ts_1.DistributeModel.updateStep2(distributionId, step2Signatures);
            distribute_model_ts_1.DistributeModel.updateStatus(distributionId, "completed");
            // Clean up temp B wallets — they have 0 balance and are useless now
            const deletedCount = distribute_model_ts_1.DistributeModel.deleteTempWallets(distributionId);
            logger_ts_1.logger.info(`Cleaned up ${deletedCount} temp B wallets for distribution ${distributionId}`);
            const updatedRecord = distribute_model_ts_1.DistributeModel.findByDistributionId(distributionId);
            logger_ts_1.logger.info(`Distribution complete — ${numWallets} C wallets funded via obfuscated path`);
            logger_ts_1.logger.info(`C wallets group: ${cGroupTag}`);
            return {
                distributionId,
                mainWallet: mainWalletPublicKey,
                bWallets: bPublicKeys,
                cWallets: cPublicKeys,
                bWalletsGroupTag: bGroupTag,
                cWalletsGroupTag: cGroupTag,
                solPerWallet,
                totalSol,
                step1TxSignature: step1Sig,
                step2TxSignatures: step2Signatures,
            };
        }
        catch (error) {
            try {
                distribute_model_ts_1.DistributeModel.updateStatus(distributionId, "failed");
            }
            catch { }
            if (error instanceof errorHandler_ts_1.AppError)
                throw error;
            logger_ts_1.logger.error(`Distribution failed: ${error.message}`);
            throw new errorHandler_ts_1.AppError(`Distribution failed: ${error.message}`, 500);
        }
    }
    /**
     * Get distribution details
     */
    static async getDistribution(distributionId) {
        const record = distribute_model_ts_1.DistributeModel.findByDistributionId(distributionId);
        if (!record) {
            throw new errorHandler_ts_1.AppError(`Distribution not found: ${distributionId}`, 404);
        }
        return toPublicInfo(record);
    }
    /**
     * List all distributions
     */
    static async listDistributions(options) {
        const { distributions, total } = distribute_model_ts_1.DistributeModel.list(options);
        return {
            distributions: distributions.map(toPublicInfo),
            total,
            page: options.page,
            limit: options.limit,
        };
    }
    /**
     * Get the C wallets (destination/buyer wallets) for a distribution
     */
    static async getDestinationWallets(distributionId) {
        const record = distribute_model_ts_1.DistributeModel.findByDistributionId(distributionId);
        if (!record) {
            throw new errorHandler_ts_1.AppError(`Distribution not found: ${distributionId}`, 404);
        }
        const wallets = wallet_model_ts_1.WalletModel.getPublicKeysByGroup(record.c_wallets_group_tag);
        return {
            groupTag: record.c_wallets_group_tag,
            wallets,
        };
    }
}
exports.DistributeService = DistributeService;
