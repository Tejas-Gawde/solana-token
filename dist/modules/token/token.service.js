"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenService = void 0;
const kit_1 = require("@solana/kit");
const system_1 = require("@solana-program/system");
const token_1 = require("@solana-program/token");
const signers_1 = require("@solana/signers");
const umi_bundle_defaults_1 = require("@metaplex-foundation/umi-bundle-defaults");
const mpl_token_metadata_1 = require("@metaplex-foundation/mpl-token-metadata");
const umi_1 = require("@metaplex-foundation/umi");
const bs58_1 = __importDefault(require("bs58"));
const index_ts_1 = require("../../config/index.ts");
const logger_ts_1 = require("../../utils/logger.ts");
const errorHandler_ts_1 = require("../../middleware/errorHandler.ts");
const wallet_service_ts_1 = require("../wallet/wallet.service.ts");
const wallet_model_ts_1 = require("../wallet/wallet.model.ts");
const crypto_ts_1 = require("../../utils/crypto.ts");
const token_model_ts_1 = require("./token.model.ts");
const rpc = (0, kit_1.createSolanaRpc)(index_ts_1.config.solana.rpcUrl);
function toPublicInfo(record) {
    return {
        id: record.id,
        mintAddress: record.mint_address,
        creatorWallet: record.creator_wallet,
        decimals: record.decimals,
        initialSupply: record.initial_supply,
        initialSupplyRaw: record.initial_supply_raw,
        mintAuthority: record.mint_authority,
        freezeAuthority: record.freeze_authority,
        groupTag: record.group_tag,
        txSignature: record.tx_signature,
        name: record.name,
        symbol: record.symbol,
        uri: record.uri,
        metadataTxSignature: record.metadata_tx_signature,
        createdAt: record.created_at,
    };
}
/**
 * Get a UMI-compatible keypair from a stored wallet's raw bytes
 */
function getUmiKeypairFromWallet(publicKey) {
    const record = wallet_model_ts_1.WalletModel.findByPublicKey(publicKey);
    if (!record) {
        throw new errorHandler_ts_1.AppError(`Wallet not found: ${publicKey}`, 404);
    }
    const privateKeyBase58 = (0, crypto_ts_1.decryptPrivateKey)(record.encrypted_private_key);
    const secretKeyBytes = bs58_1.default.decode(privateKeyBase58);
    if (secretKeyBytes.length !== 64) {
        throw new errorHandler_ts_1.AppError("Stored key is corrupted", 500);
    }
    return {
        publicKey: (0, umi_1.publicKey)(publicKey),
        secretKey: new Uint8Array(secretKeyBytes),
    };
}
/**
 * Create a UMI instance with a signer from our wallet store
 */
function createUmiWithSigner(creatorPublicKey) {
    const umi = (0, umi_bundle_defaults_1.createUmi)(index_ts_1.config.solana.rpcUrl);
    const umiKeypair = getUmiKeypairFromWallet(creatorPublicKey);
    const umiSigner = (0, umi_1.createSignerFromKeypair)(umi, umiKeypair);
    umi.use((0, umi_1.signerIdentity)(umiSigner));
    return { umi, umiSigner };
}
class TokenService {
    /**
     * Create a new SPL token (without metadata)
     */
    static async createToken(options) {
        const { creatorPublicKey, decimals = 9, initialSupply, groupTag, freezeAuthority = false, } = options;
        try {
            logger_ts_1.logger.info(`Creating token — creator: ${creatorPublicKey}, decimals: ${decimals}, supply: ${initialSupply}`);
            const creatorSigner = await wallet_service_ts_1.WalletService.getSignerForWallet(creatorPublicKey);
            const creatorAddress = (0, kit_1.address)(creatorPublicKey);
            const mintKeypairSigner = await (0, signers_1.generateKeyPairSigner)();
            const mintAddress = mintKeypairSigner.address;
            logger_ts_1.logger.info(`Mint account address: ${mintAddress}`);
            const supplyBigInt = BigInt(Math.floor(initialSupply));
            const decimalMultiplier = BigInt(10) ** BigInt(decimals);
            const rawSupply = supplyBigInt * decimalMultiplier;
            const U64_MAX = BigInt("18446744073709551615");
            if (rawSupply > U64_MAX) {
                throw new errorHandler_ts_1.AppError(`Total raw supply (${rawSupply}) exceeds u64 max. ` +
                    `Reduce initialSupply or decimals. ` +
                    `Max supply with ${decimals} decimals: ${U64_MAX / decimalMultiplier}`, 400);
            }
            const mintSize = (0, token_1.getMintSize)();
            const rentLamports = await rpc
                .getMinimumBalanceForRentExemption(BigInt(mintSize))
                .send();
            const [ataAddress] = await (0, token_1.findAssociatedTokenPda)({
                mint: mintAddress,
                owner: creatorAddress,
                tokenProgram: token_1.TOKEN_PROGRAM_ADDRESS,
            });
            logger_ts_1.logger.info(`Associated Token Account: ${ataAddress}`);
            const freezeAuth = freezeAuthority
                ? creatorAddress
                : null;
            const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
            const instructions = [
                (0, system_1.getCreateAccountInstruction)({
                    payer: creatorSigner,
                    newAccount: mintKeypairSigner,
                    lamports: rentLamports,
                    space: mintSize,
                    programAddress: token_1.TOKEN_PROGRAM_ADDRESS,
                }),
                (0, token_1.getInitializeMintInstruction)({
                    mint: mintAddress,
                    decimals,
                    mintAuthority: creatorAddress,
                    freezeAuthority: freezeAuth,
                }),
                (0, token_1.getCreateAssociatedTokenIdempotentInstruction)({
                    payer: creatorSigner,
                    owner: creatorAddress,
                    mint: mintAddress,
                    ata: ataAddress,
                }),
                (0, token_1.getMintToInstruction)({
                    mint: mintAddress,
                    token: ataAddress,
                    mintAuthority: creatorSigner,
                    amount: rawSupply,
                }),
            ];
            const transactionMessage = (0, kit_1.pipe)((0, kit_1.createTransactionMessage)({ version: 0 }), (msg) => (0, kit_1.setTransactionMessageFeePayer)(creatorAddress, msg), (msg) => (0, kit_1.setTransactionMessageLifetimeUsingBlockhash)(latestBlockhash, msg), (msg) => (0, kit_1.appendTransactionMessageInstructions)(instructions, msg));
            const signedTransaction = await (0, kit_1.signTransaction)([creatorSigner.keyPair, mintKeypairSigner.keyPair], (0, kit_1.compileTransaction)(transactionMessage));
            const txSignature = (0, kit_1.getSignatureFromTransaction)(signedTransaction);
            const encodedTransaction = (0, kit_1.getBase64EncodedWireTransaction)(signedTransaction);
            await rpc
                .sendTransaction(encodedTransaction, {
                skipPreflight: false,
                maxRetries: BigInt(3),
                encoding: "base64",
            })
                .send();
            logger_ts_1.logger.info(`Token creation tx sent: ${txSignature}`);
            let confirmed = false;
            for (let i = 0; i < 60; i++) {
                try {
                    const statuses = await rpc.getSignatureStatuses([txSignature]).send();
                    const status = statuses.value[0];
                    if (status &&
                        (status.confirmationStatus === "confirmed" ||
                            status.confirmationStatus === "finalized")) {
                        if (status.err) {
                            throw new errorHandler_ts_1.AppError(`Token creation failed on-chain: ${JSON.stringify(status.err)}`, 500);
                        }
                        confirmed = true;
                        break;
                    }
                }
                catch (pollErr) {
                    if (pollErr instanceof errorHandler_ts_1.AppError)
                        throw pollErr;
                    logger_ts_1.logger.debug(`Polling error: ${pollErr.message}`);
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            if (!confirmed) {
                logger_ts_1.logger.warn(`Token creation tx ${txSignature} not confirmed within timeout`);
            }
            const record = token_model_ts_1.TokenModel.create({
                mintAddress: mintAddress,
                creatorWallet: creatorPublicKey,
                decimals,
                initialSupply: initialSupply.toString(),
                initialSupplyRaw: rawSupply.toString(),
                mintAuthority: creatorPublicKey,
                freezeAuthority: freezeAuthority ? creatorPublicKey : null,
                groupTag,
                txSignature: txSignature,
            });
            logger_ts_1.logger.info(`Token created — Mint: ${mintAddress}, Supply: ${initialSupply}, Decimals: ${decimals}`);
            return {
                token: toPublicInfo(record),
                mintAddress: mintAddress,
                associatedTokenAccount: ataAddress,
                txSignature: txSignature,
                initialSupply,
                decimals,
            };
        }
        catch (error) {
            if (error instanceof errorHandler_ts_1.AppError)
                throw error;
            logger_ts_1.logger.error(`Failed to create token: ${error.message}`);
            throw new errorHandler_ts_1.AppError(`Failed to create token: ${error.message}`, 500);
        }
    }
    /**
     * Add metadata to an existing token using Metaplex Token Metadata program
     */
    static async addMetadata(options) {
        const { mintAddress, creatorPublicKey, name, symbol, uri } = options;
        try {
            // Verify token exists in our DB
            const tokenRecord = token_model_ts_1.TokenModel.findByMintAddress(mintAddress);
            if (!tokenRecord) {
                throw new errorHandler_ts_1.AppError(`Token not found in database: ${mintAddress}`, 404);
            }
            // Verify the creator matches
            if (tokenRecord.creator_wallet !== creatorPublicKey) {
                throw new errorHandler_ts_1.AppError(`Wallet ${creatorPublicKey} is not the creator of token ${mintAddress}`, 403);
            }
            // Check if metadata already exists
            if (tokenRecord.metadata_tx_signature) {
                throw new errorHandler_ts_1.AppError(`Token ${mintAddress} already has metadata attached. ` +
                    `Use update-metadata to modify it.`, 409);
            }
            logger_ts_1.logger.info(`Adding metadata to token ${mintAddress} — name: ${name}, symbol: ${symbol}`);
            // Create UMI instance with the creator's keypair
            const { umi, umiSigner } = createUmiWithSigner(creatorPublicKey);
            const mintPublicKey = (0, umi_1.publicKey)(mintAddress);
            // Find the metadata PDA
            const metadataPda = (0, mpl_token_metadata_1.findMetadataPda)(umi, { mint: mintPublicKey });
            // Create metadata account
            const txBuilder = (0, mpl_token_metadata_1.createMetadataAccountV3)(umi, {
                metadata: metadataPda,
                mint: mintPublicKey,
                mintAuthority: umiSigner,
                payer: umiSigner,
                updateAuthority: umiSigner.publicKey,
                data: {
                    name,
                    symbol,
                    uri,
                    sellerFeeBasisPoints: 0,
                    creators: [
                        {
                            address: umiSigner.publicKey,
                            verified: true,
                            share: 100,
                        },
                    ],
                    collection: null,
                    uses: null,
                },
                isMutable: true,
                collectionDetails: null,
            });
            const result = await txBuilder.sendAndConfirm(umi, {
                send: { commitment: "confirmed" },
                confirm: { commitment: "confirmed" },
            });
            const metadataTxSignature = bs58_1.default.encode(result.signature);
            logger_ts_1.logger.info(`Metadata added to token ${mintAddress} — tx: ${metadataTxSignature}`);
            // Update database
            const updatedRecord = token_model_ts_1.TokenModel.updateMetadata(mintAddress, {
                name,
                symbol,
                uri,
                metadataTxSignature,
            });
            return {
                token: toPublicInfo(updatedRecord),
                mintAddress,
                metadataTxSignature,
                name,
                symbol,
                uri,
            };
        }
        catch (error) {
            if (error instanceof errorHandler_ts_1.AppError)
                throw error;
            logger_ts_1.logger.error(`Failed to add metadata: ${error.message}`);
            throw new errorHandler_ts_1.AppError(`Failed to add metadata: ${error.message}`, 500);
        }
    }
    /**
     * Create a token AND attach metadata in one flow
     */
    static async createTokenWithMetadata(options) {
        const { creatorPublicKey, decimals, initialSupply, name, symbol, uri, groupTag, freezeAuthority, } = options;
        try {
            // Step 1: Create the SPL token
            logger_ts_1.logger.info(`Creating token with metadata — name: ${name}, symbol: ${symbol}`);
            const tokenResult = await this.createToken({
                creatorPublicKey,
                decimals,
                initialSupply,
                groupTag,
                freezeAuthority,
            });
            // Small delay to ensure the mint account is fully confirmed
            await new Promise((resolve) => setTimeout(resolve, 2000));
            // Step 2: Add metadata
            const metadataResult = await this.addMetadata({
                mintAddress: tokenResult.mintAddress,
                creatorPublicKey,
                name,
                symbol,
                uri,
            });
            logger_ts_1.logger.info(`Token created with metadata — Mint: ${tokenResult.mintAddress}, Name: ${name}, Symbol: ${symbol}`);
            return {
                token: metadataResult.token,
                mintAddress: tokenResult.mintAddress,
                associatedTokenAccount: tokenResult.associatedTokenAccount,
                txSignature: tokenResult.txSignature,
                metadataTxSignature: metadataResult.metadataTxSignature,
                initialSupply,
                decimals: decimals || 9,
                name,
                symbol,
                uri,
            };
        }
        catch (error) {
            if (error instanceof errorHandler_ts_1.AppError)
                throw error;
            logger_ts_1.logger.error(`Failed to create token with metadata: ${error.message}`);
            throw new errorHandler_ts_1.AppError(`Failed to create token with metadata: ${error.message}`, 500);
        }
    }
    /**
     * Get token info by mint address
     */
    static async getToken(mintAddress) {
        const record = token_model_ts_1.TokenModel.findByMintAddress(mintAddress);
        if (!record) {
            throw new errorHandler_ts_1.AppError(`Token not found: ${mintAddress}`, 404);
        }
        return toPublicInfo(record);
    }
    /**
     * List tokens with filters
     */
    static async listTokens(options) {
        const { tokens, total } = token_model_ts_1.TokenModel.list(options);
        return {
            tokens: tokens.map(toPublicInfo),
            total,
            page: options.page,
            limit: options.limit,
        };
    }
    /**
     * Get on-chain mint info
     */
    static async getOnChainMintInfo(mintAddress) {
        try {
            const mintAddr = (0, kit_1.address)(mintAddress);
            const accountInfo = await rpc
                .getAccountInfo(mintAddr, { encoding: "jsonParsed" })
                .send();
            if (!accountInfo.value) {
                throw new errorHandler_ts_1.AppError(`Mint account not found on-chain: ${mintAddress}`, 404);
            }
            const parsed = accountInfo.value.data?.parsed;
            if (!parsed || parsed.type !== "mint") {
                throw new errorHandler_ts_1.AppError(`Account is not a valid mint: ${mintAddress}`, 400);
            }
            const info = parsed.info;
            return {
                mintAddress,
                supply: info.supply,
                decimals: info.decimals,
                mintAuthority: info.mintAuthority || null,
                freezeAuthority: info.freezeAuthority || null,
                isInitialized: info.isInitialized,
            };
        }
        catch (error) {
            if (error instanceof errorHandler_ts_1.AppError)
                throw error;
            logger_ts_1.logger.error(`Failed to get on-chain mint info: ${error.message}`);
            throw new errorHandler_ts_1.AppError(`Failed to get mint info: ${error.message}`, 502);
        }
    }
    /**
     * Get on-chain metadata for a token
     */
    static async getOnChainMetadata(mintAddress) {
        try {
            const umi = (0, umi_bundle_defaults_1.createUmi)(index_ts_1.config.solana.rpcUrl);
            const mintPublicKey = (0, umi_1.publicKey)(mintAddress);
            const metadataPda = (0, mpl_token_metadata_1.findMetadataPda)(umi, { mint: mintPublicKey });
            const accountInfo = await rpc
                .getAccountInfo((0, kit_1.address)(metadataPda[0]), {
                encoding: "jsonParsed",
            })
                .send();
            if (!accountInfo.value) {
                throw new errorHandler_ts_1.AppError(`No metadata found on-chain for token: ${mintAddress}`, 404);
            }
            // Use UMI to deserialize metadata
            const { fetchMetadataFromSeeds } = await Promise.resolve().then(() => __importStar(require("@metaplex-foundation/mpl-token-metadata")));
            const metadata = await fetchMetadataFromSeeds(umi, {
                mint: mintPublicKey,
            });
            return {
                mintAddress,
                name: metadata.name.replace(/\0/g, "").trim(),
                symbol: metadata.symbol.replace(/\0/g, "").trim(),
                uri: metadata.uri.replace(/\0/g, "").trim(),
                sellerFeeBasisPoints: metadata.sellerFeeBasisPoints,
                creators: metadata.creators?.__option === "Some"
                    ? metadata.creators.value.map((c) => ({
                        address: c.address.toString(),
                        verified: c.verified,
                        share: c.share,
                    }))
                    : null,
                isMutable: metadata.isMutable,
            };
        }
        catch (error) {
            if (error instanceof errorHandler_ts_1.AppError)
                throw error;
            logger_ts_1.logger.error(`Failed to get on-chain metadata: ${error.message}`);
            throw new errorHandler_ts_1.AppError(`Failed to get metadata: ${error.message}`, 502);
        }
    }
}
exports.TokenService = TokenService;
