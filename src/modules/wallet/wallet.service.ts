import { createKeyPairSignerFromBytes } from "@solana/signers";
import type { KeyPairSigner } from "@solana/signers";
import { createSolanaRpc } from "@solana/rpc";
import { address, lamports } from "@solana/kit";
import type { Signature } from "@solana/kit";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import crypto from "node:crypto";
import { config } from "../../config/index.ts";
import { encryptPrivateKey, decryptPrivateKey } from "../../utils/crypto.ts";
import { logger } from "../../utils/logger.ts";
import { AppError } from "../../middleware/errorHandler.ts";
import { WalletModel } from "./wallet.model.ts";
import type {
  WalletPublicInfo,
  WalletWithPrivateKey,
  WalletRecord,
  GenerateWalletOptions,
  BatchGenerateOptions,
  ImportWalletOptions,
  FundWalletOptions,
  BatchExportResult,
} from "./wallet.types.ts";

const rpc = createSolanaRpc(config.solana.rpcUrl);

const ED25519_PKCS8_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);

function toPublicInfo(record: WalletRecord): WalletPublicInfo {
  return {
    id: record.id,
    publicKey: record.public_key,
    groupTag: record.group_tag,
    isActive: record.is_active === 1,
    balanceLamports: record.balance_lamports,
    balanceSol: record.balance_lamports / 1_000_000_000,
    lastBalanceCheck: record.last_balance_check,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function toWalletWithKey(
  record: WalletRecord,
  privateKeyBase58: string,
): WalletWithPrivateKey {
  return {
    ...toPublicInfo(record),
    privateKeyBase58,
  };
}

function generateSolanaKeypair(): {
  publicKey: string;
  privateKeyBase58: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });

  const seed = Buffer.from(privateKey).subarray(16, 48);
  const pubKeyBytes = Buffer.from(publicKey).subarray(12, 44);

  const fullKeypair = new Uint8Array(64);
  fullKeypair.set(seed, 0);
  fullKeypair.set(pubKeyBytes, 32);

  return {
    publicKey: bs58.encode(pubKeyBytes),
    privateKeyBase58: bs58.encode(fullKeypair),
  };
}

export class WalletService {
  /**
   * Generate a single new wallet
   */
  static async generateWallet(
    options: GenerateWalletOptions = {},
  ): Promise<WalletPublicInfo> {
    try {
      const { publicKey, privateKeyBase58 } = generateSolanaKeypair();
      const encryptedPrivateKey = encryptPrivateKey(privateKeyBase58);

      const record = WalletModel.create({
        publicKey,
        encryptedPrivateKey,
        groupTag: options.groupTag,
      });

      logger.info(`Generated new wallet: ${publicKey}`);
      return toPublicInfo(record);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`Failed to generate wallet: ${error.message}`);
      throw new AppError(`Failed to generate wallet: ${error.message}`, 500);
    }
  }

  /**
   * Batch generate multiple wallets
   */
  static async batchGenerateWallets(
    options: BatchGenerateOptions,
  ): Promise<WalletPublicInfo[]> {
    try {
      const walletsData: Array<{
        publicKey: string;
        encryptedPrivateKey: string;
        groupTag?: string;
      }> = [];

      for (let i = 0; i < options.count; i++) {
        const { publicKey, privateKeyBase58 } = generateSolanaKeypair();
        const encryptedPrivateKey = encryptPrivateKey(privateKeyBase58);

        walletsData.push({
          publicKey,
          encryptedPrivateKey,
          groupTag: options.groupTag,
        });
      }

      const records = WalletModel.createBatch(walletsData);

      logger.info(
        `Batch generated ${records.length} wallets${
          options.groupTag ? ` [group: ${options.groupTag}]` : ""
        }`,
      );

      return records.map(toPublicInfo);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`Failed to batch generate wallets: ${error.message}`);
      throw new AppError(
        `Failed to batch generate wallets: ${error.message}`,
        500,
      );
    }
  }

  /**
   * Import a wallet from a base58 private key
   */
  static async importWallet(
    options: ImportWalletOptions,
  ): Promise<WalletPublicInfo> {
    try {
      const { privateKeyBase58, groupTag } = options;
      const secretKeyBytes = bs58.decode(privateKeyBase58);

      if (secretKeyBytes.length !== 64) {
        throw new AppError(
          "Invalid private key: expected 64-byte Solana keypair (base58 encoded)",
          400,
        );
      }

      const seed = secretKeyBytes.slice(0, 32);
      const providedPubKey = secretKeyBytes.slice(32, 64);

      const privateKeyObj = crypto.createPrivateKey({
        key: Buffer.concat([ED25519_PKCS8_PREFIX, Buffer.from(seed)]),
        format: "der",
        type: "pkcs8",
      });
      const publicKeyObj = crypto.createPublicKey(privateKeyObj);
      const derivedPubKeyDer = publicKeyObj.export({
        type: "spki",
        format: "der",
      });
      const derivedPubKey = Buffer.from(derivedPubKeyDer).subarray(12, 44);

      if (!Buffer.from(providedPubKey).equals(derivedPubKey)) {
        throw new AppError(
          "Invalid keypair: public key does not match the private key seed",
          400,
        );
      }

      const publicKey = bs58.encode(providedPubKey);

      const existing = WalletModel.findByPublicKey(publicKey);
      if (existing) {
        throw new AppError(
          `Wallet with public key ${publicKey} already exists in the database`,
          409,
        );
      }

      const encryptedPrivateKey = encryptPrivateKey(privateKeyBase58);

      const record = WalletModel.create({
        publicKey,
        encryptedPrivateKey,
        groupTag,
      });

      logger.info(`Imported wallet: ${publicKey}`);
      return toPublicInfo(record);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`Failed to import wallet: ${error.message}`);
      throw new AppError(`Failed to import wallet: ${error.message}`, 400);
    }
  }

  /**
   * Export private key for a single wallet
   */
  static async exportPrivateKey(
    publicKey: string,
  ): Promise<WalletWithPrivateKey> {
    const record = WalletModel.findByPublicKey(publicKey);
    if (!record) {
      throw new AppError(`Wallet not found: ${publicKey}`, 404);
    }

    try {
      const privateKeyBase58 = decryptPrivateKey(record.encrypted_private_key);
      logger.warn(`Private key exported for wallet: ${publicKey}`);
      return toWalletWithKey(record, privateKeyBase58);
    } catch (error: any) {
      logger.error(
        `Failed to decrypt private key for ${publicKey}: ${error.message}`,
      );
      throw new AppError("Failed to decrypt private key", 500);
    }
  }

  /**
   * Batch export all wallets in a group with their private keys
   */
  static async batchExportByGroup(
    groupTag: string,
  ): Promise<BatchExportResult> {
    const records = WalletModel.findByGroupTag(groupTag);

    if (records.length === 0) {
      throw new AppError(
        `No active wallets found for group tag: ${groupTag}`,
        404,
      );
    }

    try {
      const wallets: WalletWithPrivateKey[] = records.map((record) => {
        const privateKeyBase58 = decryptPrivateKey(
          record.encrypted_private_key,
        );
        return toWalletWithKey(record, privateKeyBase58);
      });

      logger.warn(
        `Batch exported ${wallets.length} wallets for group: ${groupTag}`,
      );

      return {
        groupTag,
        count: wallets.length,
        wallets,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(
        `Failed to batch export wallets for group ${groupTag}: ${error.message}`,
      );
      throw new AppError(
        `Failed to batch export wallets: ${error.message}`,
        500,
      );
    }
  }

  /**
   * Get wallet info (public only)
   */
  static async getWallet(publicKey: string): Promise<WalletPublicInfo> {
    const record = WalletModel.findByPublicKey(publicKey);
    if (!record) {
      throw new AppError(`Wallet not found: ${publicKey}`, 404);
    }
    return toPublicInfo(record);
  }

  static async listWallets(options: {
    groupTag?: string;
    page: number;
    limit: number;
  }): Promise<{
    wallets: WalletPublicInfo[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { wallets, total } = WalletModel.list({
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
  static async fundWallet(options: FundWalletOptions): Promise<{
    publicKey: string;
    signature: string;
    amountSol: number;
    amountLamports: number;
  }> {
    const { publicKey, amountSol = 1 } = options;

    if (config.solana.network !== "devnet") {
      throw new AppError("Airdrop is only available on devnet", 400);
    }

    const record = WalletModel.findByPublicKey(publicKey);
    if (!record) {
      throw new AppError(`Wallet not found in database: ${publicKey}`, 404);
    }

    try {
      const amountLamports = Math.floor(amountSol * 1_000_000_000);
      const walletAddress = address(publicKey);

      logger.info(`Requesting airdrop of ${amountSol} SOL to ${publicKey}...`);

      const signature = await rpc
        .requestAirdrop(walletAddress, lamports(BigInt(amountLamports)))
        .send();

      logger.info(
        `Airdrop requested. Signature: ${signature}. Waiting for confirmation...`,
      );

      // Poll for confirmation
      let confirmed = false;
      for (let i = 0; i < 30; i++) {
        const statuses = await rpc
          .getSignatureStatuses([signature as Signature])
          .send();

        const status = statuses.value[0];
        if (
          status &&
          (status.confirmationStatus === "confirmed" ||
            status.confirmationStatus === "finalized")
        ) {
          confirmed = true;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (!confirmed) {
        logger.warn(
          `Airdrop signature ${signature} not confirmed within timeout, but may still succeed`,
        );
      }

      // Update balance
      try {
        const balanceResult = await rpc.getBalance(walletAddress).send();
        WalletModel.updateBalance(publicKey, Number(balanceResult.value));
      } catch (balanceErr) {
        logger.warn(`Could not update balance after airdrop: ${balanceErr}`);
      }

      // Record the transaction
      WalletModel.recordTransaction({
        walletId: record.id,
        signature: signature as string,
        txType: "airdrop",
        amountLamports,
        status: confirmed ? "confirmed" : "pending",
      });

      logger.info(
        `Airdrop of ${amountSol} SOL to ${publicKey} - signature: ${signature}`,
      );

      return {
        publicKey,
        signature: signature as string,
        amountSol,
        amountLamports,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`Airdrop failed for ${publicKey}: ${error.message}`);
      throw new AppError(`Airdrop failed: ${error.message}`, 502);
    }
  }

  /**
   * Refresh the on-chain balance for a wallet
   */
  static async refreshBalance(publicKey: string): Promise<WalletPublicInfo> {
    const record = WalletModel.findByPublicKey(publicKey);
    if (!record) {
      throw new AppError(`Wallet not found: ${publicKey}`, 404);
    }

    try {
      const walletAddress = address(publicKey);
      const balanceResult = await rpc.getBalance(walletAddress).send();
      WalletModel.updateBalance(publicKey, Number(balanceResult.value));

      const updatedRecord = WalletModel.findByPublicKey(publicKey)!;
      return toPublicInfo(updatedRecord);
    } catch (error: any) {
      logger.error(
        `Failed to refresh balance for ${publicKey}: ${error.message}`,
      );
      throw new AppError(`Failed to refresh balance: ${error.message}`, 502);
    }
  }

  /**
   * Deactivate a wallet (soft delete)
   */
  static async deactivateWallet(publicKey: string): Promise<WalletPublicInfo> {
    const record = WalletModel.findByPublicKey(publicKey);
    if (!record) {
      throw new AppError(`Wallet not found: ${publicKey}`, 404);
    }

    WalletModel.deactivate(publicKey);
    const updated = WalletModel.findByPublicKey(publicKey)!;
    logger.info(`Wallet deactivated: ${publicKey}`);
    return toPublicInfo(updated);
  }

  /**
   * Update wallet metadata
   */
  static async updateWallet(
    publicKey: string,
    data: { groupTag?: string },
  ): Promise<WalletPublicInfo> {
    const record = WalletModel.findByPublicKey(publicKey);
    if (!record) {
      throw new AppError(`Wallet not found: ${publicKey}`, 404);
    }

    const updated = WalletModel.update(publicKey, data);
    return toPublicInfo(updated!);
  }

  /**
   * Get a KeyPairSigner from a stored wallet (for other modules)
   */
  static async getSignerForWallet(publicKey: string): Promise<KeyPairSigner> {
    const record = WalletModel.findByPublicKey(publicKey);
    if (!record) {
      throw new AppError(`Wallet not found: ${publicKey}`, 404);
    }

    const privateKeyBase58 = decryptPrivateKey(record.encrypted_private_key);
    const secretKeyBytes = bs58.decode(privateKeyBase58);

    if (secretKeyBytes.length !== 64) {
      throw new AppError("Stored key is corrupted", 500);
    }

    return await createKeyPairSignerFromBytes(secretKeyBytes, false);
  }

  /**
   * Get a KeyPair from a stored wallet (for other modules) using web3.js directly
   */
  static async getKeypairForWallet(publicKey: string): Promise<Keypair> {
    const record = WalletModel.findByPublicKey(publicKey);
    if (!record) {
      throw new AppError(`Wallet not found: ${publicKey}`, 404);
    }

    const privateKeyBase58 = decryptPrivateKey(record.encrypted_private_key);
    const secretKeyBytes = bs58.decode(privateKeyBase58);

    if (secretKeyBytes.length !== 64) {
      throw new AppError("Stored key is corrupted", 500);
    }

    return Keypair.fromSecretKey(secretKeyBytes);
  }
}
