"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const signers_1 = require("@solana/signers");
const rpc_1 = require("@solana/rpc");
const kit_1 = require("@solana/kit");
const web3_js_1 = require("@solana/web3.js");
const bs58_1 = __importDefault(require("bs58"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const index_ts_1 = require("../../config/index.ts");
const crypto_ts_1 = require("../../utils/crypto.ts");
const logger_ts_1 = require("../../utils/logger.ts");
const errorHandler_ts_1 = require("../../middleware/errorHandler.ts");
const wallet_model_ts_1 = require("./wallet.model.ts");
const rpc = (0, rpc_1.createSolanaRpc)(index_ts_1.config.solana.rpcUrl);
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
function toPublicInfo(record) {
    return {
        id: record.id,
        publicKey: record.public_key,
        groupTag: record.group_tag,
        isActive: record.is_active === 1,
        balanceLamports: record.balance_lamports,
        balanceSol: record.balance_lamports / 1000000000,
        lastBalanceCheck: record.last_balance_check,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
    };
}
function toWalletWithKey(record, privateKeyBase58) {
    return {
        ...toPublicInfo(record),
        privateKeyBase58,
    };
}
function generateSolanaKeypair() {
    const { publicKey, privateKey } = node_crypto_1.default.generateKeyPairSync("ed25519", {
        publicKeyEncoding: { type: "spki", format: "der" },
        privateKeyEncoding: { type: "pkcs8", format: "der" },
    });
    const seed = Buffer.from(privateKey).subarray(16, 48);
    const pubKeyBytes = Buffer.from(publicKey).subarray(12, 44);
    const fullKeypair = new Uint8Array(64);
    fullKeypair.set(seed, 0);
    fullKeypair.set(pubKeyBytes, 32);
    return {
        publicKey: bs58_1.default.encode(pubKeyBytes),
        privateKeyBase58: bs58_1.default.encode(fullKeypair),
    };
}
class WalletService {
    /**
     * Generate a single new wallet
     */
    static async generateWallet(options = {}) {
        try {
            const { publicKey, privateKeyBase58 } = generateSolanaKeypair();
            const encryptedPrivateKey = (0, crypto_ts_1.encryptPrivateKey)(privateKeyBase58);
            const record = wallet_model_ts_1.WalletModel.create({
                publicKey,
                encryptedPrivateKey,
                groupTag: options.groupTag,
            });
            logger_ts_1.logger.info(`Generated new wallet: ${publicKey}`);
            return toPublicInfo(record);
        }
        catch (error) {
            if (error instanceof errorHandler_ts_1.AppError)
                throw error;
            logger_ts_1.logger.error(`Failed to generate wallet: ${error.message}`);
            throw new errorHandler_ts_1.AppError(`Failed to generate wallet: ${error.message}`, 500);
        }
    }
    /**
     * Batch generate multiple wallets
     */
    static async batchGenerateWallets(options) {
        try {
            const walletsData = [];
            for (let i = 0; i < options.count; i++) {
                const { publicKey, privateKeyBase58 } = generateSolanaKeypair();
                const encryptedPrivateKey = (0, crypto_ts_1.encryptPrivateKey)(privateKeyBase58);
                walletsData.push({
                    publicKey,
                    encryptedPrivateKey,
                    groupTag: options.groupTag,
                });
            }
            const records = wallet_model_ts_1.WalletModel.createBatch(walletsData);
            logger_ts_1.logger.info(`Batch generated ${records.length} wallets${options.groupTag ? ` [group: ${options.groupTag}]` : ""}`);
            return records.map(toPublicInfo);
        }
        catch (error) {
            if (error instanceof errorHandler_ts_1.AppError)
                throw error;
            logger_ts_1.logger.error(`Failed to batch generate wallets: ${error.message}`);
            throw new errorHandler_ts_1.AppError(`Failed to batch generate wallets: ${error.message}`, 500);
        }
    }
    /**
     * Import a wallet from a base58 private key
     */
    static async importWallet(options) {
        try {
            const { privateKeyBase58, groupTag } = options;
            const secretKeyBytes = bs58_1.default.decode(privateKeyBase58);
            if (secretKeyBytes.length !== 64) {
                throw new errorHandler_ts_1.AppError("Invalid private key: expected 64-byte Solana keypair (base58 encoded)", 400);
            }
            const seed = secretKeyBytes.slice(0, 32);
            const providedPubKey = secretKeyBytes.slice(32, 64);
            const privateKeyObj = node_crypto_1.default.createPrivateKey({
                key: Buffer.concat([ED25519_PKCS8_PREFIX, Buffer.from(seed)]),
                format: "der",
                type: "pkcs8",
            });
            const publicKeyObj = node_crypto_1.default.createPublicKey(privateKeyObj);
            const derivedPubKeyDer = publicKeyObj.export({
                type: "spki",
                format: "der",
            });
            const derivedPubKey = Buffer.from(derivedPubKeyDer).subarray(12, 44);
            if (!Buffer.from(providedPubKey).equals(derivedPubKey)) {
                throw new errorHandler_ts_1.AppError("Invalid keypair: public key does not match the private key seed", 400);
            }
            const publicKey = bs58_1.default.encode(providedPubKey);
            const existing = wallet_model_ts_1.WalletModel.findByPublicKey(publicKey);
            if (existing) {
                throw new errorHandler_ts_1.AppError(`Wallet with public key ${publicKey} already exists in the database`, 409);
            }
            const encryptedPrivateKey = (0, crypto_ts_1.encryptPrivateKey)(privateKeyBase58);
            const record = wallet_model_ts_1.WalletModel.create({
                publicKey,
                encryptedPrivateKey,
                groupTag,
            });
            logger_ts_1.logger.info(`Imported wallet: ${publicKey}`);
            return toPublicInfo(record);
        }
        catch (error) {
            if (error instanceof errorHandler_ts_1.AppError)
                throw error;
            logger_ts_1.logger.error(`Failed to import wallet: ${error.message}`);
            throw new errorHandler_ts_1.AppError(`Failed to import wallet: ${error.message}`, 400);
        }
    }
    /**
     * Export private key for a single wallet
     */
    static async exportPrivateKey(publicKey) {
        const record = wallet_model_ts_1.WalletModel.findByPublicKey(publicKey);
        if (!record) {
            throw new errorHandler_ts_1.AppError(`Wallet not found: ${publicKey}`, 404);
        }
        try {
            const privateKeyBase58 = (0, crypto_ts_1.decryptPrivateKey)(record.encrypted_private_key);
            logger_ts_1.logger.warn(`Private key exported for wallet: ${publicKey}`);
            return toWalletWithKey(record, privateKeyBase58);
        }
        catch (error) {
            logger_ts_1.logger.error(`Failed to decrypt private key for ${publicKey}: ${error.message}`);
            throw new errorHandler_ts_1.AppError("Failed to decrypt private key", 500);
        }
    }
    /**
     * Batch export all wallets in a group with their private keys
     */
    static async batchExportByGroup(groupTag) {
        const records = wallet_model_ts_1.WalletModel.findByGroupTag(groupTag);
        if (records.length === 0) {
            throw new errorHandler_ts_1.AppError(`No active wallets found for group tag: ${groupTag}`, 404);
        }
        try {
            const wallets = records.map((record) => {
                const privateKeyBase58 = (0, crypto_ts_1.decryptPrivateKey)(record.encrypted_private_key);
                return toWalletWithKey(record, privateKeyBase58);
            });
            logger_ts_1.logger.warn(`Batch exported ${wallets.length} wallets for group: ${groupTag}`);
            return {
                groupTag,
                count: wallets.length,
                wallets,
            };
        }
        catch (error) {
            if (error instanceof errorHandler_ts_1.AppError)
                throw error;
            logger_ts_1.logger.error(`Failed to batch export wallets for group ${groupTag}: ${error.message}`);
            throw new errorHandler_ts_1.AppError(`Failed to batch export wallets: ${error.message}`, 500);
        }
    }
    /**
     * Get wallet info (public only)
     */
    static async getWallet(publicKey) {
        const record = wallet_model_ts_1.WalletModel.findByPublicKey(publicKey);
        if (!record) {
            throw new errorHandler_ts_1.AppError(`Wallet not found: ${publicKey}`, 404);
        }
        return toPublicInfo(record);
    }
    static async listWallets(options) {
        const { wallets, total } = wallet_model_ts_1.WalletModel.list({
            groupTag: options.groupTag,
            page: options.page,
            limit: options.limit,
        });
        return {
            wallets: wallets.map(toPublicInfo),
            total,
            page: options.page,
            limit: options.limit,
        };
    }
    /**
     * Fund a wallet using devnet
     */
    static async fundWallet(options) {
        const { publicKey, amountSol = 1 } = options;
        if (index_ts_1.config.solana.network !== "devnet") {
            throw new errorHandler_ts_1.AppError("Airdrop is only available on devnet", 400);
        }
        const record = wallet_model_ts_1.WalletModel.findByPublicKey(publicKey);
        if (!record) {
            throw new errorHandler_ts_1.AppError(`Wallet not found in database: ${publicKey}`, 404);
        }
        try {
            const amountLamports = Math.floor(amountSol * 1000000000);
            const walletAddress = (0, kit_1.address)(publicKey);
            logger_ts_1.logger.info(`Requesting airdrop of ${amountSol} SOL to ${publicKey}...`);
            const signature = await rpc
                .requestAirdrop(walletAddress, (0, kit_1.lamports)(BigInt(amountLamports)))
                .send();
            logger_ts_1.logger.info(`Airdrop requested. Signature: ${signature}. Waiting for confirmation...`);
            // Poll for confirmation
            let confirmed = false;
            for (let i = 0; i < 30; i++) {
                const statuses = await rpc
                    .getSignatureStatuses([signature])
                    .send();
                const status = statuses.value[0];
                if (status &&
                    (status.confirmationStatus === "confirmed" ||
                        status.confirmationStatus === "finalized")) {
                    confirmed = true;
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            if (!confirmed) {
                logger_ts_1.logger.warn(`Airdrop signature ${signature} not confirmed within timeout, but may still succeed`);
            }
            // Update balance
            try {
                const balanceResult = await rpc.getBalance(walletAddress).send();
                wallet_model_ts_1.WalletModel.updateBalance(publicKey, Number(balanceResult.value));
            }
            catch (balanceErr) {
                logger_ts_1.logger.warn(`Could not update balance after airdrop: ${balanceErr}`);
            }
            // Record the transaction
            wallet_model_ts_1.WalletModel.recordTransaction({
                walletId: record.id,
                signature: signature,
                txType: "airdrop",
                amountLamports,
                status: confirmed ? "confirmed" : "pending",
            });
            logger_ts_1.logger.info(`Airdrop of ${amountSol} SOL to ${publicKey} - signature: ${signature}`);
            return {
                publicKey,
                signature: signature,
                amountSol,
                amountLamports,
            };
        }
        catch (error) {
            if (error instanceof errorHandler_ts_1.AppError)
                throw error;
            logger_ts_1.logger.error(`Airdrop failed for ${publicKey}: ${error.message}`);
            throw new errorHandler_ts_1.AppError(`Airdrop failed: ${error.message}`, 502);
        }
    }
    /**
     * Refresh the on-chain balance for a wallet
     */
    static async refreshBalance(publicKey) {
        const record = wallet_model_ts_1.WalletModel.findByPublicKey(publicKey);
        if (!record) {
            throw new errorHandler_ts_1.AppError(`Wallet not found: ${publicKey}`, 404);
        }
        try {
            const walletAddress = (0, kit_1.address)(publicKey);
            const balanceResult = await rpc.getBalance(walletAddress).send();
            wallet_model_ts_1.WalletModel.updateBalance(publicKey, Number(balanceResult.value));
            const updatedRecord = wallet_model_ts_1.WalletModel.findByPublicKey(publicKey);
            return toPublicInfo(updatedRecord);
        }
        catch (error) {
            logger_ts_1.logger.error(`Failed to refresh balance for ${publicKey}: ${error.message}`);
            throw new errorHandler_ts_1.AppError(`Failed to refresh balance: ${error.message}`, 502);
        }
    }
    /**
     * Deactivate a wallet (soft delete)
     */
    static async deactivateWallet(publicKey) {
        const record = wallet_model_ts_1.WalletModel.findByPublicKey(publicKey);
        if (!record) {
            throw new errorHandler_ts_1.AppError(`Wallet not found: ${publicKey}`, 404);
        }
        wallet_model_ts_1.WalletModel.deactivate(publicKey);
        const updated = wallet_model_ts_1.WalletModel.findByPublicKey(publicKey);
        logger_ts_1.logger.info(`Wallet deactivated: ${publicKey}`);
        return toPublicInfo(updated);
    }
    /**
     * Update wallet metadata
     */
    static async updateWallet(publicKey, data) {
        const record = wallet_model_ts_1.WalletModel.findByPublicKey(publicKey);
        if (!record) {
            throw new errorHandler_ts_1.AppError(`Wallet not found: ${publicKey}`, 404);
        }
        const updated = wallet_model_ts_1.WalletModel.update(publicKey, data);
        return toPublicInfo(updated);
    }
    /**
     * Get a KeyPairSigner from a stored wallet (for other modules)
     */
    static async getSignerForWallet(publicKey) {
        const record = wallet_model_ts_1.WalletModel.findByPublicKey(publicKey);
        if (!record) {
            throw new errorHandler_ts_1.AppError(`Wallet not found: ${publicKey}`, 404);
        }
        const privateKeyBase58 = (0, crypto_ts_1.decryptPrivateKey)(record.encrypted_private_key);
        const secretKeyBytes = bs58_1.default.decode(privateKeyBase58);
        if (secretKeyBytes.length !== 64) {
            throw new errorHandler_ts_1.AppError("Stored key is corrupted", 500);
        }
        return await (0, signers_1.createKeyPairSignerFromBytes)(secretKeyBytes, false);
    }
    /**
     * Get a KeyPair from a stored wallet (for other modules) using web3.js directly
     */
    static async getKeypairForWallet(publicKey) {
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
}
exports.WalletService = WalletService;
