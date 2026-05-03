import {
  AddressLookupTableProgram,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  OnlinePumpSdk,
  PUMP_SDK,
  getBuyTokenAmountFromSolAmount,
} from "@pump-fun/pump-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import { v4 as uuidv4 } from "uuid";
import bs58 from "bs58";
import { config } from "../../config/index.ts";
import { AppError } from "../../middleware/errorHandler.ts";
import { logger } from "../../utils/logger.ts";
import { WalletService } from "../wallet/wallet.service.ts";
import { DistributeModel } from "../distribute/distribute.model.ts";
import { WalletModel } from "../wallet/wallet.model.ts";
import { JitoService } from "./jito.service.ts";
import { LaunchBundleModel } from "./launch-bundle.model.ts";
import type {
  BundleBuyerConfig,
  LaunchBundleOptions,
  LaunchBundlePublicInfo,
  LaunchBundleResult,
} from "./launch-bundle.types.ts";

const connection = new Connection(config.solana.rpcUrl, "confirmed");

async function testConnection() {
  try {
    const connection = new Connection(config.solana.rpcUrl, "confirmed");
    const blockhash = await connection.getLatestBlockhash("confirmed");
    console.log("Connection successful:", blockhash);
  } catch (error) {
    console.error("Connection failed:", error);
    // This will show the actual underlying error
  }
}

function buildInitialBondingCurveState(
  global: any,
  mint: PublicKey,
  creator: PublicKey,
): { bondingCurve: any; bondingCurveAccountInfo: any } {
  // The initial bonding curve, freshly created, has:
  // - virtualTokenReserves = global.initialVirtualTokenReserves
  // - virtualSolReserves   = global.initialVirtualSolReserves
  // - realTokenReserves    = global.initialRealTokenReserves
  // - realSolReserves      = 0
  // - tokenTotalSupply     = global.tokenTotalSupply
  // - complete             = false
  // - creator              = the creator pubkey

  const bondingCurve = {
    virtualTokenReserves: new BN(global.initialVirtualTokenReserves.toString()),
    virtualSolReserves: new BN(global.initialVirtualSolReserves.toString()),
    realTokenReserves: new BN(global.initialRealTokenReserves.toString()),
    realSolReserves: new BN(0),
    tokenTotalSupply: new BN(global.tokenTotalSupply.toString()),
    complete: false,
    creator: creator,
  };

  // bondingCurveAccountInfo is a fake AccountInfo<Buffer>
  // The SDK mostly uses .data length / .owner — give it sane defaults
  const bondingCurveAccountInfo = {
    executable: false,
    owner: new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"), // pump program
    lamports: 1_000_000,
    data: Buffer.alloc(150), // bonding curve account size; not actually parsed by SDK if it has `bondingCurve` already
    rentEpoch: 0,
  };

  return { bondingCurve, bondingCurveAccountInfo };
}

function parsePublicKey(value: string, name: string): PublicKey {
  try {
    return new PublicKey(value);
  } catch {
    throw new AppError(`Invalid public key: ${name}`, 400);
  }
}

function solToLamports(sol: number): BN {
  if (!Number.isFinite(sol) || sol <= 0) {
    throw new AppError("Invalid SOL amount", 400);
  }
  const lamports = BigInt(Math.floor(sol * 1_000_000_000));
  return new BN(lamports.toString());
}

function parseMintKeypairFromPrivateKey(privateKey: number[]): Keypair {
  if (!Array.isArray(privateKey) || privateKey.length !== 64) {
    throw new AppError("mintPrivateKey must contain exactly 64 bytes", 400);
  }

  try {
    return Keypair.fromSecretKey(Uint8Array.from(privateKey));
  } catch {
    throw new AppError("Invalid mintPrivateKey", 400);
  }
}

export class LaunchBundleService {
  static async launch(
    options: LaunchBundleOptions,
  ): Promise<LaunchBundleResult> {
    const launchBundleId = uuidv4();
    logger.info(`[${launchBundleId}] Starting launch bundle process`);

    const {
      creatorPublicKey,
      userPublicKey,
      distributionId,
      name,
      symbol,
      uri,
      mintPrivateKey,
      mayhemMode = false,
      cashback = false,
      buyers,
      jitoTipSol = config.jito.defaultTipSol,
    } = options;

    const resolvedDistributionId = distributionId?.trim() || "direct-wallets";

    LaunchBundleModel.create({
      launchBundleId,
      distributionId: resolvedDistributionId,
      creatorWallet: creatorPublicKey,
      userWallet: userPublicKey,
      requestPayload: options as unknown as Record<string, unknown>,
    });

    try {
      logger.info(`[${launchBundleId}] Parsing public keys`);
      const creator = parsePublicKey(creatorPublicKey, "creatorPublicKey");
      const user = parsePublicKey(userPublicKey, "userPublicKey");

      logger.info(
        `[${launchBundleId}] Getting user keypair for wallet: ${userPublicKey}`,
      );
      const userKeypair =
        await WalletService.getKeypairForWallet(userPublicKey);

      logger.info(`[${launchBundleId}] Processing mint keypair`);
      const mintKeypair = mintPrivateKey
        ? parseMintKeypairFromPrivateKey(mintPrivateKey)
        : Keypair.generate();
      logger.info(
        `[${launchBundleId}] Mint address: ${mintKeypair.publicKey.toBase58()}`,
      );

      if (distributionId?.trim()) {
        logger.info(
          `[${launchBundleId}] Validating buyer wallets from distribution: ${distributionId}`,
        );
        await this.validateBuyerWalletsFromDistribution(distributionId, buyers);
      } else {
        logger.info(`[${launchBundleId}] Validating duplicate buyer wallets`);
        this.validateDuplicateBuyerWallets(buyers);
      }

      logger.info(`[${launchBundleId}] Loading buyer signers`);
      const buyerSigners = await this.loadBuyerSigners(buyers);

      logger.info(`[${launchBundleId}] Running preflight balance checks`);
      await this.preflightBalances(user, buyerSigners, buyers, jitoTipSol);

      logger.info(`[${launchBundleId}] Collecting lookup addresses`);
      const lookupAddresses = this.collectLookupAddresses({
        creator,
        user,
        mint: mintKeypair.publicKey,
        buyers,
      });
      logger.info(
        `[${launchBundleId}] Collected ${lookupAddresses.length} lookup addresses`,
      );

      logger.info(`[${launchBundleId}] Creating and extending lookup table`);
      const lutInfo = await this.createAndExtendLookupTable(
        userKeypair,
        lookupAddresses,
      );
      logger.info(
        `[${launchBundleId}] LUT created at: ${lutInfo.lutAddress.toBase58()}`,
      );

      logger.info(`[${launchBundleId}] Waiting for LUT activation`);
      await this.waitForLutActivation(lutInfo.lutAddress);
      logger.info(`[${launchBundleId}] LUT activated successfully`);

      logger.info(`[${launchBundleId}] Fetching LUT account`);
      const lutAccount = await this.fetchLookupTableOrThrow(lutInfo.lutAddress);

      // Add detailed logging before blockhash fetch
      logger.info(
        `[${launchBundleId}] Attempting to get latest blockhash from RPC: ${config.solana.rpcUrl}`,
      );
      logger.info(
        `[${launchBundleId}] Connection object created with commitment: confirmed`,
      );

      let blockhashResult;
      try {
        logger.info(
          `[${launchBundleId}] Calling connection.getLatestBlockhash("confirmed")...`,
        );
        blockhashResult = await connection.getLatestBlockhash("confirmed");
        logger.info(
          `[${launchBundleId}] Successfully got blockhash: ${blockhashResult.blockhash}`,
        );
      } catch (error: any) {
        logger.error(
          `[${launchBundleId}] Failed to get blockhash - Error details:`,
          {
            message: error?.message,
            name: error?.name,
            code: error?.code,
            cause: error?.cause,
            stack: error?.stack,
          },
        );
        throw new AppError(
          `Failed to get recent blockhash: ${error?.message || error}`,
          500,
        );
      }

      const { blockhash } = blockhashResult;
      logger.info(`[${launchBundleId}] Blockhash obtained: ${blockhash}`);

      logger.info(`[${launchBundleId}] Building launch instructions`);
      const launchInstructions = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: config.jito.computeUnitPriceMicroLamports,
        }),
        await PUMP_SDK.createV2Instruction({
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

      logger.info(`[${launchBundleId}] Compiling launch message`);
      const launchMessage = new TransactionMessage({
        payerKey: user,
        recentBlockhash: blockhash,
        instructions: launchInstructions,
      }).compileToV0Message([lutAccount]);
      const launchTx = new VersionedTransaction(launchMessage);
      launchTx.sign([userKeypair, mintKeypair]);

      const serialized = launchTx.serialize();
      logger.info(
        `[${launchBundleId}] Launch tx size: ${serialized.length} bytes (limit 1232)`,
      );
      logger.info(
        `[${launchBundleId}] Static keys: ${launchMessage.staticAccountKeys.length}`,
      );
      logger.info(
        `[${launchBundleId}] LUT writable lookups: ${launchMessage.addressTableLookups[0]?.writableIndexes.length ?? 0}`,
      );
      logger.info(
        `[${launchBundleId}] LUT readonly lookups: ${launchMessage.addressTableLookups[0]?.readonlyIndexes.length ?? 0}`,
      );

      logger.info(
        `[${launchBundleId}] Fetching global and fee config from pump SDK`,
      );
      const onlinePumpSdk = new OnlinePumpSdk(connection);
      const global = await onlinePumpSdk.fetchGlobal();
      const feeConfig = await onlinePumpSdk.fetchFeeConfig();
      logger.info(
        `[${launchBundleId}] Global and fee config fetched successfully`,
      );

      // Build the initial state once (same for all buyers — they each get a fresh BC view)
      const {
        bondingCurve: initialBondingCurve,
        bondingCurveAccountInfo: initialBcAccountInfo,
      } = buildInitialBondingCurveState(global, mintKeypair.publicKey, creator);

      logger.info(
        `[${launchBundleId}] Building buyer transactions for ${buyers.length} buyers`,
      );
      const buyerTransactions: VersionedTransaction[] = [];
      for (const [i, buyer] of buyers.entries()) {
        logger.info(
          `[${launchBundleId}] Processing buyer ${i + 1}/${buyers.length}: ${buyer.walletPublicKey}`,
        );
        const buyerSigner = buyerSigners[i];
        if (!buyerSigner)
          throw new AppError(`Missing signer for buyer at index ${i}`, 500);

        const buyerPubkey = parsePublicKey(
          buyer.walletPublicKey,
          "buyer wallet",
        );
        const solAmount = solToLamports(buyer.buySolAmount);

        const amount = getBuyTokenAmountFromSolAmount({
          global,
          feeConfig,
          mintSupply: null,
          bondingCurve: null, // initial state
          amount: solAmount,
        });

        const buyInstructions = await PUMP_SDK.buyInstructions({
          global,
          bondingCurveAccountInfo: initialBcAccountInfo,
          associatedUserAccountInfo: null, // ATA doesn't exist yet — will be created
          bondingCurve: initialBondingCurve,
          mint: mintKeypair.publicKey,
          user: buyerPubkey,
          amount,
          solAmount,
          slippage: Math.max(buyer.slippage ?? 1, 50), // BUMP slippage (50% recommended for bundle buys)
          tokenProgram: TOKEN_PROGRAM_ID,
        });

        const buyerMessage = new TransactionMessage({
          payerKey: buyerPubkey,
          recentBlockhash: blockhash,
          instructions: [
            ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: config.jito.computeUnitPriceMicroLamports,
            }),
            ...buyInstructions,
          ],
        }).compileToV0Message([lutAccount]);

        const buyerTx = new VersionedTransaction(buyerMessage);
        buyerTx.sign([buyerSigner]);
        buyerTransactions.push(buyerTx);
        logger.info(
          `[${launchBundleId}] Buyer ${i + 1} transaction built successfully`,
        );
      }

      logger.info(`[${launchBundleId}] Building tip transaction`);
      const tipAccount = parsePublicKey(
        await JitoService.getTipAccount(),
        "jitoTip",
      );
      const tipLamports = Number(solToLamports(jitoTipSol).toString());
      const tipMessage = new TransactionMessage({
        payerKey: user,
        recentBlockhash: blockhash,
        instructions: [
          SystemProgram.transfer({
            fromPubkey: user,
            toPubkey: tipAccount,
            lamports: tipLamports,
          }),
        ],
      }).compileToV0Message([lutAccount]);
      const tipTx = new VersionedTransaction(tipMessage);
      tipTx.sign([userKeypair]);

      const tipSerialized = tipTx.serialize();
      logger.info(
        `[${launchBundleId}] Tip tx size: ${tipSerialized.length} bytes (limit 1232)`,
      );
      logger.info(
        `[${launchBundleId}] Static keys: ${tipMessage.staticAccountKeys.length}`,
      );
      logger.info(
        `[${launchBundleId}] LUT writable lookups: ${tipMessage.addressTableLookups[0]?.writableIndexes.length ?? 0}`,
      );
      logger.info(
        `[${launchBundleId}] LUT readonly lookups: ${tipMessage.addressTableLookups[0]?.readonlyIndexes.length ?? 0}`,
      );

      const bundleTransactions = [launchTx, ...buyerTransactions, tipTx];
      logger.info(
        `[${launchBundleId}] Sending bundle with ${bundleTransactions.length} transactions to Jito`,
      );
      const bundleId = await JitoService.sendBundle(bundleTransactions);
      logger.info(`[${launchBundleId}] Bundle sent, ID: ${bundleId}`);

      const bundleStatus = await JitoService.waitForBundleFinalStatus(bundleId);
      logger.info(`[${launchBundleId}] Bundle final status: ${bundleStatus}`);

      const result: LaunchBundleResult = {
        launchBundleId,
        bundleId,
        mintAddress: mintKeypair.publicKey.toBase58(),
        lookupTableAddress: lutInfo.lutAddress.toBase58(),
        createLutSignature: lutInfo.createSignature,
        extendLutSignatures: lutInfo.extendSignatures,
        launchTxSignature: this.getFirstSignature(launchTx),
        buyerTxSignatures: buyerTransactions.map((tx) =>
          this.getFirstSignature(tx),
        ),
        tipTxSignature: this.getFirstSignature(tipTx),
        buyerWallets: buyers.map((buyer) => buyer.walletPublicKey),
        status: bundleStatus,
      };

      LaunchBundleModel.updateSuccess(launchBundleId, {
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

      logger.info(`[${launchBundleId}] Launch bundle completed successfully`);
      return result;
    } catch (error: any) {
      logger.error(`[${launchBundleId}] Launch bundle failed at step:`, {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });

      LaunchBundleModel.updateFailure(
        launchBundleId,
        error?.message || "Unknown launch bundle error",
      );
      logger.error(
        `Launch bundle failed (${launchBundleId}): ${error?.message}`,
      );
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Launch bundle failed: ${error?.message || error}`,
        500,
      );
    }
  }

  static async getLaunchBundle(
    launchBundleId: string,
  ): Promise<LaunchBundlePublicInfo> {
    const launchBundle = LaunchBundleModel.findByLaunchBundleId(launchBundleId);
    if (!launchBundle) {
      throw new AppError(`Launch bundle not found: ${launchBundleId}`, 404);
    }
    return launchBundle;
  }

  private static async validateBuyerWalletsFromDistribution(
    distributionId: string,
    buyers: BundleBuyerConfig[],
  ): Promise<void> {
    const distribution = DistributeModel.findByDistributionId(distributionId);
    if (!distribution) {
      throw new AppError(`Distribution not found: ${distributionId}`, 404);
    }

    const allowedWallets = new Set(
      WalletModel.getPublicKeysByGroup(distribution.c_wallets_group_tag),
    );

    if (allowedWallets.size === 0) {
      throw new AppError(
        `No C wallets found for distribution ${distributionId}`,
        404,
      );
    }

    const seen = new Set<string>();
    for (const buyer of buyers) {
      if (!allowedWallets.has(buyer.walletPublicKey)) {
        throw new AppError(
          `Buyer wallet ${buyer.walletPublicKey} is not in distribution C-wallet group`,
          400,
        );
      }
      if (seen.has(buyer.walletPublicKey)) {
        throw new AppError(
          `Duplicate buyer wallet in request: ${buyer.walletPublicKey}`,
          400,
        );
      }
      seen.add(buyer.walletPublicKey);
    }
  }

  private static validateDuplicateBuyerWallets(
    buyers: BundleBuyerConfig[],
  ): void {
    const seen = new Set<string>();
    for (const buyer of buyers) {
      if (seen.has(buyer.walletPublicKey)) {
        throw new AppError(
          `Duplicate buyer wallet in request: ${buyer.walletPublicKey}`,
          400,
        );
      }
      seen.add(buyer.walletPublicKey);
    }
  }

  private static async loadBuyerSigners(
    buyers: BundleBuyerConfig[],
  ): Promise<Keypair[]> {
    return Promise.all(
      buyers.map((buyer) =>
        WalletService.getKeypairForWallet(buyer.walletPublicKey),
      ),
    );
  }

  private static async preflightBalances(
    user: PublicKey,
    buyerSigners: Keypair[],
    buyers: BundleBuyerConfig[],
    jitoTipSol: number,
  ): Promise<void> {
    const userBalance = await connection.getBalance(user, "confirmed");
    const neededForUser =
      Number(solToLamports(jitoTipSol).toString()) + 2_000_000;
    if (userBalance < neededForUser) {
      throw new AppError(
        `Insufficient user wallet balance for LUT txs + tip. Have ${userBalance}, need at least ${neededForUser} lamports`,
        400,
      );
    }

    for (const [i, buyer] of buyers.entries()) {
      const buyerSigner = buyerSigners[i];
      if (!buyerSigner) {
        throw new AppError(`Missing signer for buyer at index ${i}`, 500);
      }
      const buyerBalance = await connection.getBalance(
        buyerSigner.publicKey,
        "confirmed",
      );
      const buyLamports = Number(solToLamports(buyer.buySolAmount).toString());
      const needed = buyLamports + 1_000_000;
      if (buyerBalance < needed) {
        throw new AppError(
          `Insufficient balance in buyer wallet ${buyer.walletPublicKey}. Have ${buyerBalance}, need at least ${needed} lamports`,
          400,
        );
      }
    }
  }

  private static collectLookupAddresses(input: {
    creator: PublicKey;
    user: PublicKey;
    mint: PublicKey;
    buyers: BundleBuyerConfig[];
  }): PublicKey[] {
    const keys = new Map<string, PublicKey>();
    const addKey = (key: PublicKey) => keys.set(key.toBase58(), key);

    addKey(input.creator);
    addKey(input.user);
    addKey(input.mint);
    addKey(SystemProgram.programId);
    addKey(ComputeBudgetProgram.programId);

    for (const buyer of input.buyers) {
      addKey(parsePublicKey(buyer.walletPublicKey, "buyer wallet"));
    }

    return [...keys.values()];
  }

  private static async createAndExtendLookupTable(
    authority: Keypair,
    addresses: PublicKey[],
  ): Promise<{
    lutAddress: PublicKey;
    createSignature: string;
    extendSignatures: string[];
  }> {
    let lutAddress: PublicKey | null = null;
    let createSignature = "";
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // LUT creation is sensitive to slot staleness; use finalized slot and retry.
        const recentSlot = await connection.getSlot("finalized");
        const [createIx, candidateLutAddress] =
          AddressLookupTableProgram.createLookupTable({
            authority: authority.publicKey,
            payer: authority.publicKey,
            recentSlot,
          });

        createSignature = await this.sendSingleInstructionTransaction(
          [createIx],
          authority.publicKey,
          [authority],
        );
        lutAddress = candidateLutAddress;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
        }
      }
    }

    if (!lutAddress) {
      const message =
        lastError instanceof Error
          ? lastError.message
          : "unknown LUT creation error";
      throw new AppError(`Failed to create lookup table: ${message}`, 500);
    }

    const extendSignatures: string[] = [];
    // Keep LUT extend chunks conservative to avoid instruction-data overflow.
    const chunkSize = 10;
    for (let i = 0; i < addresses.length; i += chunkSize) {
      const chunk = addresses.slice(i, i + chunkSize);
      const extendIx = AddressLookupTableProgram.extendLookupTable({
        payer: authority.publicKey,
        authority: authority.publicKey,
        lookupTable: lutAddress,
        addresses: chunk,
      });
      const sig = await this.sendSingleInstructionTransaction(
        [extendIx],
        authority.publicKey,
        [authority],
      );
      extendSignatures.push(sig);
    }

    return { lutAddress, createSignature, extendSignatures };
  }

  private static async fetchLookupTableOrThrow(
    lutAddress: PublicKey,
  ): Promise<
    NonNullable<
      Awaited<ReturnType<typeof connection.getAddressLookupTable>>["value"]
    >
  > {
    const result = await connection.getAddressLookupTable(lutAddress, {
      commitment: "finalized",
    });
    if (!result.value) {
      throw new AppError(
        `Failed to fetch lookup table account ${lutAddress.toBase58()}`,
        500,
      );
    }
    return result.value;
  }

  private static async waitForLutActivation(
    lutAddress: PublicKey,
    maxAttempts = 20,
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await connection.getAddressLookupTable(lutAddress, {
          commitment: "finalized",
        });
        if (result.value && result.value.state.addresses.length > 0) {
          // Ensure we've moved past the lastExtendedSlot
          const currentSlot = await connection.getSlot("finalized");
          const lastExtended = Number(result.value.state.lastExtendedSlot);
          if (currentSlot > lastExtended) {
            return;
          }
        }
      } catch (err) {
        // Ignore deserialization races and retry
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new AppError(
      `LUT ${lutAddress.toBase58()} did not activate in time`,
      500,
    );
  }

  private static async sendSingleInstructionTransaction(
    instructions: TransactionInstruction[],
    payer: PublicKey,
    signers: Keypair[],
  ): Promise<string> {
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    const msg = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    tx.sign(signers);
    const sig = await connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3,
    });
    const confirmation = await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "finalized", // <-- changed from "confirmed"
    );
    if (confirmation.value.err) {
      throw new AppError(
        `Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`,
        500,
      );
    }
    return sig;
  }

  private static getFirstSignature(transaction: VersionedTransaction): string {
    if (!transaction.signatures[0]) {
      throw new AppError("Transaction has no signature", 500);
    }
    return bs58.encode(transaction.signatures[0]);
  }
}
