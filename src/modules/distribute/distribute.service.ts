import {
  Connection,
  Keypair,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  NATIVE_MINT,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
} from "@solana/spl-token";
import { v4 as uuidv4 } from "uuid";
import bs58 from "bs58";
import { config } from "../../config/index.ts";
import { logger } from "../../utils/logger.ts";
import { AppError } from "../../middleware/errorHandler.ts";
import { WalletModel } from "../wallet/wallet.model.ts";
import { decryptPrivateKey, encryptPrivateKey } from "../../utils/crypto.ts";
import { DistributeModel } from "./distribute.model.ts";
import type {
  DistributionPublicInfo,
  DistributionRecord,
  DistributeOptions,
  DistributeResult,
} from "./distribute.types.ts";

const connection = new Connection(config.solana.rpcUrl, "confirmed");

const MAX_RETRIES = 5;
const BATCH_SIZE = 4;

function toPublicInfo(record: DistributionRecord): DistributionPublicInfo {
  let step2Sigs: string[] = [];
  try {
    if (record.step2_tx_signatures) {
      step2Sigs = JSON.parse(record.step2_tx_signatures);
    }
  } catch { }

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
function getKeypairFromWallet(publicKey: string): Keypair {
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

/**
 * Send and confirm a versioned transaction with retries
 */
async function sendAndConfirmWithRetry(
  transaction: VersionedTransaction,
  label: string
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const signature = await connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          maxRetries: 3,
        }
      );

      logger.info(`${label} — tx sent: ${signature} (attempt ${attempt})`);

      const latestBlockhash = await connection.getLatestBlockhash();
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error(
          `Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`
        );
      }

      logger.info(`${label} — confirmed: ${signature}`);
      return signature;
    } catch (error: any) {
      logger.warn(
        `${label} — attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`
      );

      if (attempt === MAX_RETRIES) {
        throw new AppError(
          `${label} failed after ${MAX_RETRIES} attempts: ${error.message}`,
          500
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }

  throw new AppError("Should not reach here", 500);
}

/**
 * Store a C wallet (buyer/destination) into the main wallets table
 */
function storeCWalletInMainTable(keypair: Keypair, groupTag: string): string {
  const publicKey = keypair.publicKey.toBase58();
  const secretKeyBase58 = bs58.encode(keypair.secretKey);
  const encryptedPrivateKey = encryptPrivateKey(secretKeyBase58);

  const existing = WalletModel.findByPublicKey(publicKey);
  if (!existing) {
    WalletModel.create({
      publicKey,
      encryptedPrivateKey,
      groupTag,
    });
  }

  return publicKey;
}

export class DistributeService {
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
  static async distribute(options: DistributeOptions): Promise<DistributeResult> {
    const { mainWalletPublicKey, numWallets, solPerWallet, groupTag } = options;

    const distributionId = uuidv4();
    const bGroupTag = `${groupTag}-dist`;
    const cGroupTag = `${groupTag}-dist`;

    try {
      // Validate main wallet
      const mainKp = getKeypairFromWallet(mainWalletPublicKey);

      // Check balance
      const mainBalance = await connection.getBalance(mainKp.publicKey);
      const solAmountPerWallet = Math.floor(
        (solPerWallet + 0.01) * LAMPORTS_PER_SOL
      );
      const totalNeeded =
        solAmountPerWallet * numWallets + 0.01 * LAMPORTS_PER_SOL;

      if (mainBalance < totalNeeded) {
        throw new AppError(
          `Insufficient balance. Main wallet has ${(mainBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL, ` +
          `needs ~${(totalNeeded / LAMPORTS_PER_SOL).toFixed(4)} SOL ` +
          `(${numWallets} × ${solPerWallet} SOL + fees)`,
          400
        );
      }

      logger.info(
        `Starting distribution: ${mainWalletPublicKey} → ${numWallets} wallets × ${solPerWallet} SOL`
      );

      // Generate B (temp) and C (buyer) keypairs
      const bWallets: Keypair[] = [];
      const cWallets: Keypair[] = [];

      for (let i = 0; i < numWallets; i++) {
        bWallets.push(Keypair.generate());
        cWallets.push(Keypair.generate());
      }

      // Store B wallets in temp table (batch insert)
      const bTempData = bWallets.map((kp, index) => ({
        publicKey: kp.publicKey.toBase58(),
        encryptedPrivateKey: encryptPrivateKey(bs58.encode(kp.secretKey)),
        distributionId,
        walletIndex: index,
      }));

      DistributeModel.createTempWalletsBatch(bTempData);
      logger.info(`${numWallets} B wallets stored in temp table`);

      // Store C wallets in main wallets table
      const cPublicKeys: string[] = [];
      for (let i = 0; i < numWallets; i++) {
        cPublicKeys.push(storeCWalletInMainTable(cWallets[i], cGroupTag));
      }
      logger.info(`${numWallets} C wallets stored in main wallets table [group: ${cGroupTag}]`);

      const bPublicKeys = bWallets.map((kp) => kp.publicKey.toBase58());
      const totalSol = solPerWallet * numWallets;

      // Create distribution record
      const record = DistributeModel.create({
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
      logger.info("Step 1: Main → B wallets (transfer SOL)...");

      const step1Ixs: TransactionInstruction[] = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 250_000 }),
      ];

      for (let i = 0; i < numWallets; i++) {
        step1Ixs.push(
          SystemProgram.transfer({
            fromPubkey: mainKp.publicKey,
            toPubkey: bWallets[i].publicKey,
            lamports: solAmountPerWallet,
          })
        );
      }

      const step1Blockhash = await connection.getLatestBlockhash();
      const step1Message = new TransactionMessage({
        payerKey: mainKp.publicKey,
        recentBlockhash: step1Blockhash.blockhash,
        instructions: step1Ixs,
      }).compileToV0Message();

      const step1Tx = new VersionedTransaction(step1Message);
      step1Tx.sign([mainKp]);

      const step1Sig = await sendAndConfirmWithRetry(
        step1Tx,
        "Step 1 (Main → B)"
      );

      DistributeModel.updateStep1(distributionId, step1Sig);
      logger.info(`Step 1 complete: ${step1Sig}`);

      await new Promise((resolve) => setTimeout(resolve, 3000));

      // ====== STEP 2: B wallets → wSOL wrap → close to C wallets ======
      logger.info("Step 2: B wallets → wSOL wrap → close to C wallets...");

      const step2Signatures: string[] = [];
      const totalBatches = Math.ceil(numWallets / BATCH_SIZE);

      for (let batch = 0; batch < totalBatches; batch++) {
        const batchStart = batch * BATCH_SIZE;
        const batchEnd = Math.min(batchStart + BATCH_SIZE, numWallets);

        const batchIxs: TransactionInstruction[] = [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 250_000 }),
        ];

        const batchSigners: Keypair[] = [mainKp];

        for (let i = batchStart; i < batchEnd; i++) {
          const bWallet = bWallets[i];
          const cWallet = cWallets[i];
          const wsolAta = getAssociatedTokenAddressSync(
            NATIVE_MINT,
            bWallet.publicKey
          );

          // 1. Create wSOL ATA for B (main pays rent)
          batchIxs.push(
            createAssociatedTokenAccountInstruction(
              mainKp.publicKey,
              wsolAta,
              bWallet.publicKey,
              NATIVE_MINT
            )
          );

          // 2. B transfers ALL SOL to wSOL ATA
          batchIxs.push(
            SystemProgram.transfer({
              fromPubkey: bWallet.publicKey,
              toPubkey: wsolAta,
              lamports: solAmountPerWallet,
            })
          );

          // 3. Sync native SOL in ATA
          batchIxs.push(createSyncNativeInstruction(wsolAta));

          // 4. Close wSOL ATA → C wallet receives SOL
          batchIxs.push(
            createCloseAccountInstruction(
              wsolAta,
              cWallet.publicKey,
              bWallet.publicKey
            )
          );

          batchSigners.push(bWallet);
        }

        const batchBlockhash = await connection.getLatestBlockhash();
        const batchMessage = new TransactionMessage({
          payerKey: mainKp.publicKey,
          recentBlockhash: batchBlockhash.blockhash,
          instructions: batchIxs,
        }).compileToV0Message();

        const batchTx = new VersionedTransaction(batchMessage);
        batchTx.sign(batchSigners);

        const batchSig = await sendAndConfirmWithRetry(
          batchTx,
          `Step 2 batch ${batch + 1}/${totalBatches}`
        );

        step2Signatures.push(batchSig);

        logger.info(
          `Step 2 batch ${batch + 1}/${totalBatches} complete: ${batchSig}`
        );

        if (batch < totalBatches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      // Update DB
      DistributeModel.updateStep2(distributionId, step2Signatures);
      DistributeModel.updateStatus(distributionId, "completed");

      // Clean up temp B wallets — they have 0 balance and are useless now
      const deletedCount = DistributeModel.deleteTempWallets(distributionId);
      logger.info(
        `Cleaned up ${deletedCount} temp B wallets for distribution ${distributionId}`
      );

      const updatedRecord =
        DistributeModel.findByDistributionId(distributionId)!;

      logger.info(
        `Distribution complete — ${numWallets} C wallets funded via obfuscated path`
      );
      logger.info(`C wallets group: ${cGroupTag}`);

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
    } catch (error: any) {
      try {
        DistributeModel.updateStatus(distributionId, "failed");
      } catch { }

      if (error instanceof AppError) throw error;
      logger.error(`Distribution failed: ${error.message}`);
      throw new AppError(`Distribution failed: ${error.message}`, 500);
    }
  }

  /**
   * Get distribution details
   */
  static async getDistribution(
    distributionId: string
  ): Promise<DistributionPublicInfo> {
    const record = DistributeModel.findByDistributionId(distributionId);
    if (!record) {
      throw new AppError(`Distribution not found: ${distributionId}`, 404);
    }
    return toPublicInfo(record);
  }

  /**
   * List all distributions
   */
  static async listDistributions(options: {
    groupTag?: string;
    mainWallet?: string;
    status?: string;
    page: number;
    limit: number;
  }): Promise<{
    distributions: DistributionPublicInfo[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { distributions, total } = DistributeModel.list(options);

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
  static async getDestinationWallets(
    distributionId: string
  ): Promise<{ groupTag: string; wallets: string[] }> {
    const record = DistributeModel.findByDistributionId(distributionId);
    if (!record) {
      throw new AppError(`Distribution not found: ${distributionId}`, 404);
    }

    const wallets = WalletModel.getPublicKeysByGroup(
      record.c_wallets_group_tag
    );

    return {
      groupTag: record.c_wallets_group_tag,
      wallets,
    };
  }
}