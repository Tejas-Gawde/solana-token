import {
  Keypair,
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import bs58 from "bs58";
import { config } from "../../config/index.ts";
import { AppError } from "../../middleware/errorHandler.ts";
import { logger } from "../../utils/logger.ts";
import { WalletModel } from "../wallet/wallet.model.ts";
import { PumpLaunchModel } from "./pump-launch.model.ts";
import type {
  PumpLaunchRecord,
  PumpLaunchPublicInfo,
  CreatePumpLaunchOptions,
  PumpLaunchListOptions,
  UpdatePumpLaunchOptions,
} from "./pump-launch.types.ts";

function toPublicInfo(record: PumpLaunchRecord): PumpLaunchPublicInfo {
  return {
    id: record.id,
    mintAddress: record.mint_address,
    creatorWallet: record.creator_wallet,
    name: record.name,
    symbol: record.symbol,
    description: record.description || undefined,
    imageUrl: record.image_url || undefined,
    metadataUri: record.metadata_uri || undefined,
    twitter: record.twitter || undefined,
    telegram: record.telegram || undefined,
    website: record.website || undefined,
    initialBuySol: record.initial_buy_sol ?? undefined,
    groupTag: record.group_tag || undefined,
    createTxSignature: record.create_tx_signature,
    status: record.status,
    createdAt: record.created_at,
  };
}

const PUMP_PROGRAM_ID = new PublicKey(
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
);
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);
const PUMP_CREATE_DISCRIMINATOR = Buffer.from([24, 30, 200, 40, 5, 28, 7, 119]);
const PUMP_CREATE_V2_DISCRIMINATOR = Buffer.from([
  214, 144, 76, 236, 95, 139, 49, 180,
]);

function encodeString(value: string): Buffer {
  const raw = Buffer.from(value, "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32LE(raw.length, 0);
  return Buffer.concat([length, raw]);
}

function buildPumpCreateInstruction({
  mint,
  creator,
  name,
  symbol,
  uri,
}: {
  mint: PublicKey;
  creator: PublicKey;
  name: string;
  symbol: string;
  uri: string;
}): TransactionInstruction {
  const mintAuthority = PublicKey.findProgramAddressSync(
    [Buffer.from("mint-authority")],
    PUMP_PROGRAM_ID,
  )[0];
  const bondingCurve = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    PUMP_PROGRAM_ID,
  )[0];
  const associatedBondingCurve = getAssociatedTokenAddressSync(
    mint,
    bondingCurve,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const global = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    PUMP_PROGRAM_ID,
  )[0];
  const metadata = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID,
  )[0];
  const eventAuthority = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    PUMP_PROGRAM_ID,
  )[0];

  const data = Buffer.concat([
    PUMP_CREATE_DISCRIMINATOR,
    encodeString(name),
    encodeString(symbol),
    encodeString(uri),
    creator.toBuffer(),
  ]);

  const keys = [
    { pubkey: mint, isWritable: true, isSigner: true },
    { pubkey: mintAuthority, isWritable: false, isSigner: false },
    { pubkey: bondingCurve, isWritable: true, isSigner: false },
    { pubkey: associatedBondingCurve, isWritable: true, isSigner: false },
    { pubkey: global, isWritable: false, isSigner: false },
    { pubkey: TOKEN_METADATA_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: metadata, isWritable: true, isSigner: false },
    { pubkey: creator, isWritable: true, isSigner: true },
    { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isWritable: false, isSigner: false },
    { pubkey: eventAuthority, isWritable: false, isSigner: false },
    { pubkey: PUMP_PROGRAM_ID, isWritable: false, isSigner: false },
  ];

  return new TransactionInstruction({
    programId: PUMP_PROGRAM_ID,
    keys,
    data,
  });
}

function buildPumpCreateV2Instruction({
  mint,
  creator,
  name,
  symbol,
  uri,
  mayhemMode,
  cashback,
}: {
  mint: PublicKey;
  creator: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  mayhemMode: boolean;
  cashback: boolean;
}): TransactionInstruction {
  const mintAuthority = PublicKey.findProgramAddressSync(
    [Buffer.from("mint-authority")],
    PUMP_PROGRAM_ID,
  )[0];
  const bondingCurve = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    PUMP_PROGRAM_ID,
  )[0];
  const associatedBondingCurve = getAssociatedTokenAddressSync(
    mint,
    bondingCurve,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const global = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    PUMP_PROGRAM_ID,
  )[0];
  const mayhemProgramId = new PublicKey(
    "MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e",
  );
  const globalParams = PublicKey.findProgramAddressSync(
    [Buffer.from("global-params")],
    mayhemProgramId,
  )[0];
  const solVault = PublicKey.findProgramAddressSync(
    [Buffer.from("sol-vault")],
    mayhemProgramId,
  )[0];
  const mayhemState = PublicKey.findProgramAddressSync(
    [Buffer.from("mayhem-state"), mint.toBuffer()],
    mayhemProgramId,
  )[0];
  const mayhemTokenVault = getAssociatedTokenAddressSync(
    mint,
    solVault,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const eventAuthority = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    PUMP_PROGRAM_ID,
  )[0];

  const data = Buffer.concat([
    PUMP_CREATE_V2_DISCRIMINATOR,
    encodeString(name),
    encodeString(symbol),
    encodeString(uri),
    creator.toBuffer(),
    Buffer.from([mayhemMode ? 1 : 0]),
    Buffer.from([1, cashback ? 1 : 0]),
  ]);

  const keys = [
    { pubkey: mint, isWritable: true, isSigner: true },
    { pubkey: mintAuthority, isWritable: false, isSigner: false },
    { pubkey: bondingCurve, isWritable: true, isSigner: false },
    { pubkey: associatedBondingCurve, isWritable: true, isSigner: false },
    { pubkey: global, isWritable: false, isSigner: false },
    { pubkey: creator, isWritable: true, isSigner: true },
    { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: mayhemProgramId, isWritable: true, isSigner: false },
    { pubkey: globalParams, isWritable: false, isSigner: false },
    { pubkey: solVault, isWritable: true, isSigner: false },
    { pubkey: mayhemState, isWritable: true, isSigner: false },
    { pubkey: mayhemTokenVault, isWritable: true, isSigner: false },
    { pubkey: eventAuthority, isWritable: false, isSigner: false },
    { pubkey: PUMP_PROGRAM_ID, isWritable: false, isSigner: false },
  ];

  return new TransactionInstruction({
    programId: PUMP_PROGRAM_ID,
    keys,
    data,
  });
}

async function getCreatorKeypair(creatorWallet: string): Promise<Keypair> {
  const record = WalletModel.findByPublicKey(creatorWallet);
  if (!record) {
    throw new AppError(`Creator wallet not found: ${creatorWallet}`, 404);
  }

  const privateKeyBase58 = (
    await import("../../utils/crypto.ts")
  ).decryptPrivateKey(record.encrypted_private_key);

  const secretKey = bs58.decode(privateKeyBase58);
  if (secretKey.length !== 64) {
    throw new AppError("Creator wallet key is corrupted", 500);
  }

  return Keypair.fromSecretKey(secretKey);
}

export class PumpLaunchService {
  static async createLaunch(
    options: CreatePumpLaunchOptions,
  ): Promise<PumpLaunchPublicInfo> {
    try {
      const walletRecord = WalletModel.findByPublicKey(options.creatorWallet);
      if (!walletRecord) {
        throw new AppError(
          `Creator wallet not found in database: ${options.creatorWallet}`,
          404,
        );
      }

      const creatorKeypair = await getCreatorKeypair(options.creatorWallet);
      const mintKeypair = Keypair.generate();
      const creator = new PublicKey(options.creatorWallet);
      const connection = new Connection(config.solana.rpcUrl, "confirmed");

      const instruction = buildPumpCreateV2Instruction({
        mint: mintKeypair.publicKey,
        name: options.name,
        symbol: options.symbol,
        uri: options.metadataUri || "",
        creator,
        mayhemMode: options.mayhemMode || false,
        cashback: options.cashback || false,
      });

      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      const tx = new Transaction({
        feePayer: creatorKeypair.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
      }).add(instruction);

      tx.sign(creatorKeypair, mintKeypair);

      const signature = await sendAndConfirmTransaction(
        connection,
        tx,
        [creatorKeypair, mintKeypair],
        {
          commitment: "confirmed",
        },
      );

      const record = PumpLaunchModel.create({
        mintAddress: mintKeypair.publicKey.toBase58(),
        creatorWallet: options.creatorWallet,
        name: options.name,
        symbol: options.symbol,
        description: options.description,
        imageUrl: options.imageUrl,
        metadataUri: options.metadataUri,
        twitter: options.twitter,
        telegram: options.telegram,
        website: options.website,
        initialBuySol: options.initialBuySol,
        groupTag: options.groupTag,
        createTxSignature: signature,
        status: "created",
      });

      logger.info(
        `Pump launch created on-chain: ${record.mint_address}, tx: ${signature}`,
      );

      return toPublicInfo(record);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`Failed to prepare pump launch: ${error.message}`);
      throw new AppError(
        `Failed to prepare pump launch: ${error.message}`,
        500,
      );
    }
  }

  static async executeLaunch(
    mintAddress: string,
  ): Promise<PumpLaunchPublicInfo> {
    const record = PumpLaunchModel.findByMintAddress(mintAddress);
    if (!record) {
      throw new AppError(`Pump launch not found: ${mintAddress}`, 404);
    }

    if (record.status === "created") {
      throw new AppError(`Pump launch already executed: ${mintAddress}`, 409);
    }

    const creatorKeypair = await getCreatorKeypair(record.creator_wallet);
    const connection = new Connection(config.solana.rpcUrl, "confirmed");

    try {
      const instruction = buildPumpCreateV2Instruction({
        mint: new PublicKey(record.mint_address),
        creator: new PublicKey(record.creator_wallet),
        name: record.name,
        symbol: record.symbol,
        uri: record.metadata_uri || "",
        mayhemMode: false,
        cashback: false,
      });

      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      const tx = new Transaction({
        feePayer: creatorKeypair.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
      }).add(instruction);

      tx.sign(creatorKeypair);

      const signature = await sendAndConfirmTransaction(
        connection,
        tx,
        [creatorKeypair],
        {
          commitment: "confirmed",
        },
      );

      PumpLaunchModel.update(mintAddress, {
        create_tx_signature: signature,
        status: "created",
      });

      logger.info(`Pump launch executed: ${mintAddress}, tx: ${signature}`);

      return toPublicInfo(PumpLaunchModel.findByMintAddress(mintAddress)!);
    } catch (error: any) {
      logger.error(
        `Failed to execute pump launch ${mintAddress}: ${error.message}`,
      );
      PumpLaunchModel.update(mintAddress, {
        status: "failed",
        create_tx_signature: error.message,
      });
      throw new AppError(
        `Failed to execute pump launch: ${error.message}`,
        500,
      );
    }
  }

  static async getLaunch(mintAddress: string): Promise<PumpLaunchPublicInfo> {
    const record = PumpLaunchModel.findByMintAddress(mintAddress);
    if (!record) {
      throw new AppError(`Pump launch not found: ${mintAddress}`, 404);
    }
    return toPublicInfo(record);
  }

  static async listLaunches(options: PumpLaunchListOptions): Promise<{
    launches: PumpLaunchPublicInfo[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { launches, total } = PumpLaunchModel.list(options);
    return {
      launches: launches.map(toPublicInfo),
      total,
      page: options.page,
      limit: options.limit,
    };
  }

  static async updateLaunch(
    mintAddress: string,
    data: UpdatePumpLaunchOptions,
  ): Promise<PumpLaunchPublicInfo> {
    const updated = PumpLaunchModel.update(mintAddress, {
      status: data.status,
      description: data.description,
      image_url: data.imageUrl,
      metadata_uri: data.metadataUri,
      twitter: data.twitter,
      telegram: data.telegram,
      website: data.website,
      initial_buy_sol: data.initialBuySol,
      group_tag: data.groupTag,
    });

    if (!updated) {
      throw new AppError(`Pump launch not found: ${mintAddress}`, 404);
    }

    return toPublicInfo(updated);
  }
}
