import {
  Connection,
  PublicKey,
  TransactionInstruction,
  Keypair,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import BN from "bn.js";
import {
  PUMP_SDK,
  OnlinePumpSdk,
  getBuySolAmountFromTokenAmount,
  getBuyTokenAmountFromSolAmount,
} from "@pump-fun/pump-sdk";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { WalletService } from "../wallet/wallet.service.ts";
import { config } from "../../config/index.ts";
import { AppError } from "../../middleware/errorHandler.ts";
import type {
  LaunchPumpTokenOptions,
  LaunchPumpTokenResult,
  BuyFromBondingCurveOptions,
  BuyFromBondingCurveResult,
  MigrateBondingCurveOptions,
  MigrateBondingCurveResult,
  PumpLaunchBondingCurveInfo,
} from "./pump-launch.types.ts";

const connection = new Connection(config.solana.rpcUrl, "confirmed");

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

function serializeValue(value: unknown): unknown {
  if (value instanceof BN) return value.toString();
  if (value instanceof PublicKey) return value.toBase58();
  if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");
  if (value instanceof ArrayBuffer)
    return Buffer.from(new Uint8Array(value)).toString("base64");
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        serializeValue(v),
      ]),
    );
  }
  return value;
}

export class PumpLaunchService {
  static async launchToken(
    options: LaunchPumpTokenOptions,
  ): Promise<LaunchPumpTokenResult> {
    const {
      creatorPublicKey,
      userPublicKey,
      name,
      symbol,
      uri,
      mintPrivateKey,
      mayhemMode = false,
      cashback = false,
      initialBuySol,
      slippage = 1,
    } = options;

    const creator = parsePublicKey(creatorPublicKey, "creatorPublicKey");
    const user = parsePublicKey(userPublicKey, "userPublicKey");

    const userKeypair = await WalletService.getKeypairForWallet(userPublicKey);
    const mintKeypair = mintPrivateKey
      ? parseMintKeypairFromPrivateKey(mintPrivateKey)
      : Keypair.generate();

    const instructions: TransactionInstruction[] = [];
    let result: LaunchPumpTokenResult = {
      action: "created",
      mintAddress: mintKeypair.publicKey.toBase58(),
      txSignature: "",
    };

    if (typeof initialBuySol === "number" && initialBuySol > 0) {

      const onlinePumpSdk = new OnlinePumpSdk(connection);

      const createInstructions = await PUMP_SDK.createV2Instruction({
        mint: mintKeypair.publicKey,
        name,
        symbol,
        uri,
        creator,
        user,
        mayhemMode,
        cashback,
      });

      await this.sendTransaction(
        [createInstructions],
        [userKeypair, mintKeypair],
        user,
      );
      await new Promise(resolve => setTimeout(resolve, 2000));

      const globalAfterCreate = await onlinePumpSdk.fetchGlobal();
      const feeConfigAfterCreate = await onlinePumpSdk.fetchFeeConfig();
      const initialBuyLamports = solToLamports(initialBuySol);

      const amount = getBuyTokenAmountFromSolAmount({
        global: globalAfterCreate,
        feeConfig: feeConfigAfterCreate,
        mintSupply: null,
        bondingCurve: null,
        amount: initialBuyLamports,
      });

      const bondingCurveState = await onlinePumpSdk.fetchBuyState(
        mintKeypair.publicKey,
        user,
        await this.detectTokenProgram(mintKeypair.publicKey)
      );

      const buyInstructions = await PUMP_SDK.buyInstructions({
        global: globalAfterCreate,
        bondingCurveAccountInfo: bondingCurveState.bondingCurveAccountInfo,
        associatedUserAccountInfo: bondingCurveState.associatedUserAccountInfo,
        bondingCurve: bondingCurveState.bondingCurve,
        mint: mintKeypair.publicKey,
        user,
        amount,
        solAmount: initialBuyLamports,
        slippage: slippage,
        tokenProgram: await this.detectTokenProgram(mintKeypair.publicKey),
      });

      const buyTxSignature = await this.sendTransaction(
        buyInstructions,
        [userKeypair],
        user,
      );

      return {
        action: "created_with_buy",
        mintAddress: mintKeypair.publicKey.toBase58(),
        txSignature: buyTxSignature, // Return the buy transaction signature
        purchasedTokenAmountRaw: amount.toString(),
        spentSolLamports: initialBuyLamports.toString(),
      };
    }

    instructions.push(
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
    );

    const txSignature = await this.sendTransaction(
      instructions,
      [userKeypair, mintKeypair],
      user,
    );

    result.txSignature = txSignature;
    return result;
  }

  static async buyFromBondingCurve(
    options: BuyFromBondingCurveOptions,
  ): Promise<BuyFromBondingCurveResult> {
    const {
      mintAddress,
      userPublicKey,
      buySolAmount,
      buyTokenAmountRaw,
      slippage = 1,
    } = options;

    const user = parsePublicKey(userPublicKey, "userPublicKey");
    const mint = parsePublicKey(mintAddress, "mintAddress");

    const tokenProgram = await this.detectTokenProgram(mint);
    const userKeypair = await WalletService.getKeypairForWallet(userPublicKey);

    const onlinePumpSdk = new OnlinePumpSdk(connection);
    const global = await onlinePumpSdk.fetchGlobal();
    const feeConfig = await onlinePumpSdk.fetchFeeConfig();
    const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } =
      await onlinePumpSdk.fetchBuyState(mint, user, tokenProgram);

    const mintSupply = await this.getMintSupply(mint);

    let amount: BN;
    let solAmount: BN;

    if (typeof buySolAmount === "number") {
      solAmount = solToLamports(buySolAmount);
      amount = getBuyTokenAmountFromSolAmount({
        global,
        feeConfig,
        mintSupply,
        bondingCurve,
        amount: solAmount,
      });
    } else if (buyTokenAmountRaw) {
      amount = new BN(buyTokenAmountRaw);
      solAmount = getBuySolAmountFromTokenAmount({
        global,
        feeConfig,
        mintSupply,
        bondingCurve,
        amount,
      });
    } else {
      throw new AppError(
        "Either buySolAmount or buyTokenAmountRaw must be provided",
        400,
      );
    }

    const instructions = await PUMP_SDK.buyInstructions({
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

    const txSignature = await this.sendTransaction(
      instructions,
      [userKeypair],
      user,
    );

    return {
      mintAddress,
      txSignature,
      purchasedTokenAmountRaw: amount.toString(),
      spentSolLamports: solAmount.toString(),
      slippageBps: slippage,
    };
  }

  static async migrateBondingCurve(
    options: MigrateBondingCurveOptions,
  ): Promise<MigrateBondingCurveResult> {
    const { mintAddress, userPublicKey } = options;
    const user = parsePublicKey(userPublicKey, "userPublicKey");
    const mint = parsePublicKey(mintAddress, "mintAddress");

    const tokenProgram = await this.detectTokenProgram(mint);
    const userKeypair = await WalletService.getKeypairForWallet(userPublicKey);

    const onlinePumpSdk = new OnlinePumpSdk(connection);
    const global = await onlinePumpSdk.fetchGlobal();

    if (!global.enableMigrate) {
      throw new AppError("Pump migrations are disabled for this network", 400);
    }

    const instructions = [
      await PUMP_SDK.migrateInstruction({
        withdrawAuthority: global.withdrawAuthority,
        mint,
        user,
        tokenProgram,
      }),
    ];

    const txSignature = await this.sendTransaction(
      instructions,
      [userKeypair],
      user,
    );

    return { mintAddress, txSignature };
  }

  static async getBondingCurveInfo(
    mintAddress: string,
  ): Promise<PumpLaunchBondingCurveInfo> {
    const mint = parsePublicKey(mintAddress, "mintAddress");
    const tokenProgram = await this.detectTokenProgram(mint);
    const onlinePumpSdk = new OnlinePumpSdk(connection);
    const global = await onlinePumpSdk.fetchGlobal();
    const feeConfig = await onlinePumpSdk.fetchFeeConfig();
    const bondingCurve = await onlinePumpSdk.fetchBondingCurve(mint);
    const mintSupply = await this.getMintSupply(mint);

    return {
      mintAddress,
      tokenProgram: tokenProgram.toBase58(),
      mintSupply: mintSupply.toString(),
      global: serializeValue(global) as Record<string, unknown>,
      feeConfig: serializeValue(feeConfig) as Record<string, unknown>,
      bondingCurve: serializeValue(bondingCurve) as Record<string, unknown>,
    };
  }

  private static async detectTokenProgram(mint: PublicKey): Promise<PublicKey> {
    const commitmentLevels: string[] = ["processed", "confirmed", "finalized"];

    for (const commitment of commitmentLevels) {
      try {
        const accountInfo = await connection.getAccountInfo(mint, commitment as any);
        if (!accountInfo) {
          throw new Error("Account not found");
        }
        if (accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID))
          return TOKEN_2022_PROGRAM_ID;
        if (accountInfo.owner.equals(TOKEN_PROGRAM_ID)) return TOKEN_PROGRAM_ID;
        throw new AppError(
          `Unsupported token program for mint ${mint.toBase58()}`,
          400,
        );
      } catch (error) {
        if (commitment !== commitmentLevels[commitmentLevels.length - 1]) {
          continue;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          const accountInfo = await connection.getAccountInfo(mint, "processed");
          if (!accountInfo) {
            throw new Error("Account not found");
          }
          if (accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID))
            return TOKEN_2022_PROGRAM_ID;
          if (accountInfo.owner.equals(TOKEN_PROGRAM_ID)) return TOKEN_PROGRAM_ID;
          throw new AppError(
            `Unsupported token program for mint ${mint.toBase58()}`,
            400,
          );
        } catch (retryError) {
          throw new AppError(`Mint account not found: ${mint.toBase58()}`, 404);
        }
      }
    }
    throw new AppError(`Mint account not found: ${mint.toBase58()}`, 404);
  }

  private static async getMintSupply(mint: PublicKey): Promise<BN> {
    const supply = await connection.getTokenSupply(mint);
    return new BN(supply.value.amount);
  }

  private static async sendTransaction(
    instructions: TransactionInstruction[],
    signers: Keypair[],
    feePayer: PublicKey,
  ): Promise<string> {
    if (instructions.length === 0) {
      throw new AppError("No instructions to send", 400);
    }

    try {
      return await this.sendTransactionSingle(instructions, signers, feePayer);
    } catch (error: any) {
      if (error.message?.includes("too large") ||
        error.message?.includes("Transaction too large") ||
        error.message?.includes("base64 encoded solana_transaction")) {
        return await this.sendTransactionSplit(instructions, signers, feePayer);
      }
      if (error.message?.includes("Simulation failed") && error.getLogs) {
        try {
          const logs = await error.getLogs();
          console.error("Transaction simulation logs:", logs);
          throw new AppError(
            `Transaction simulation failed: ${error.message}. Logs: ${JSON.stringify(logs)}`,
            500,
          );
        } catch (logError: any) {
          throw new AppError(
            `Transaction simulation failed: ${error.message}. Failed to retrieve logs: ${logError.message}`,
            500,
          );
        }
      }
      throw error;
    }
  }

  private static async sendTransactionSingle(
    instructions: TransactionInstruction[],
    signers: Keypair[],
    feePayer: PublicKey,
  ): Promise<string> {
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    const messageV0 = new TransactionMessage({
      payerKey: feePayer,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const versionedTx = new VersionedTransaction(messageV0);
    versionedTx.sign(signers);

    const txSignature = await connection.sendTransaction(versionedTx, {
      skipPreflight: false,
      maxRetries: 3,
    });

    await this.awaitConfirmation(txSignature, blockhash, lastValidBlockHeight);
    return txSignature;
  }

  private static async sendTransactionSplit(
    instructions: TransactionInstruction[],
    signers: Keypair[],
    feePayer: PublicKey,
  ): Promise<string> {
    // For pump launch with buy, we'll split into:
    // 1. Token creation transaction
    // 2. Buy transaction
    // This is a simplified approach - in practice, you'd need to determine
    // which instructions belong to which transaction based on your SDK

    // For now, we'll implement a basic split heuristic:
    // If we have more than 5 instructions, split roughly in half
    if (instructions.length <= 5) {
      // If it's still small but failing, rethrow the original error
      throw new AppError("Transaction too large but cannot split further", 500);
    }

    const midPoint = Math.floor(instructions.length / 2);
    const firstBatch = instructions.slice(0, midPoint);
    const secondBatch = instructions.slice(midPoint);

    // For pump launch, the first batch is likely token creation
    // and second batch is the buy operation
    try {
      // Send first transaction (token creation)
      const firstSignature = await this.sendTransactionSingle(
        firstBatch,
        signers, // All signers needed for first batch
        feePayer
      );

      // Send second transaction (buy)
      // Using all signers for safety (both transactions likely need the same signers)
      const secondSignature = await this.sendTransactionSingle(
        secondBatch,
        signers, // All signers needed for second batch
        feePayer
      );

      // Return the last transaction signature (the buy)
      // In a real implementation, you might want to return both or handle differently
      return secondSignature;
    } catch (splitError: any) {
      // If splitting also fails, throw an informative error
      throw new AppError(
        `Failed to send transaction even after splitting: ${splitError.message}. Original transaction had ${instructions.length} instructions.`,
        500
      );
    }
  }

  private static async awaitConfirmation(
    signature: string,
    blockhash: string,
    lastValidBlockHeight: number,
  ): Promise<void> {
    const result = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );

    if (result.value.err) {
      throw new AppError(
        `Transaction failed on-chain: ${JSON.stringify(result.value.err)}`,
        500,
      );
    }
  }
}
