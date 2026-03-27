import {
  createSolanaRpc,
  pipe,
  address,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  compileTransaction,
  getSignatureFromTransaction,
  signTransaction,
  getBase64EncodedWireTransaction,
} from "@solana/kit";
import type { Address } from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  getInitializeMintInstruction,
  getMintToInstruction,
  getCreateAssociatedTokenIdempotentInstruction,
  findAssociatedTokenPda,
  getMintSize,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import { generateKeyPairSigner } from "@solana/signers";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createMetadataAccountV3,
  findMetadataPda,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  publicKey as umiPublicKey,
  signerIdentity,
  createSignerFromKeypair,
} from "@metaplex-foundation/umi";
import type { Keypair as UmiKeypair } from "@metaplex-foundation/umi";
import bs58 from "bs58";
import { config } from "../../config/index.ts";
import { logger } from "../../utils/logger.ts";
import { AppError } from "../../middleware/errorHandler.ts";
import { WalletService } from "../wallet/wallet.service.ts";
import { WalletModel } from "../wallet/wallet.model.ts";
import { decryptPrivateKey } from "../../utils/crypto.ts";
import { TokenModel } from "./token.model.ts";
import type {
  TokenPublicInfo,
  TokenRecord,
  CreateTokenOptions,
  CreateTokenResult,
  AddMetadataOptions,
  AddMetadataResult,
  CreateTokenWithMetadataOptions,
  CreateTokenWithMetadataResult,
} from "./token.types.ts";

const rpc = createSolanaRpc(config.solana.rpcUrl);

function toPublicInfo(record: TokenRecord): TokenPublicInfo {
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
function getUmiKeypairFromWallet(publicKey: string): UmiKeypair {
  const record = WalletModel.findByPublicKey(publicKey);
  if (!record) {
    throw new AppError(`Wallet not found: ${publicKey}`, 404);
  }

  const privateKeyBase58 = decryptPrivateKey(record.encrypted_private_key);
  const secretKeyBytes = bs58.decode(privateKeyBase58);

  if (secretKeyBytes.length !== 64) {
    throw new AppError("Stored key is corrupted", 500);
  }

  return {
    publicKey: umiPublicKey(publicKey),
    secretKey: new Uint8Array(secretKeyBytes),
  };
}

/**
 * Create a UMI instance with a signer from our wallet store
 */
function createUmiWithSigner(creatorPublicKey: string) {
  const umi = createUmi(config.solana.rpcUrl);
  const umiKeypair = getUmiKeypairFromWallet(creatorPublicKey);
  const umiSigner = createSignerFromKeypair(umi, umiKeypair);
  umi.use(signerIdentity(umiSigner));

  return { umi, umiSigner };
}

export class TokenService {
  /**
   * Create a new SPL token (without metadata)
   */
  static async createToken(
    options: CreateTokenOptions,
  ): Promise<CreateTokenResult> {
    const {
      creatorPublicKey,
      decimals = 9,
      initialSupply,
      groupTag,
      freezeAuthority = false,
    } = options;

    try {
      logger.info(
        `Creating token — creator: ${creatorPublicKey}, decimals: ${decimals}, supply: ${initialSupply}`,
      );

      const creatorSigner =
        await WalletService.getSignerForWallet(creatorPublicKey);
      const creatorAddress = address(creatorPublicKey);

      const mintKeypairSigner = await generateKeyPairSigner();
      const mintAddress = mintKeypairSigner.address;

      logger.info(`Mint account address: ${mintAddress}`);

      const supplyBigInt = BigInt(Math.floor(initialSupply));
      const decimalMultiplier = BigInt(10) ** BigInt(decimals);
      const rawSupply = supplyBigInt * decimalMultiplier;

      const U64_MAX = BigInt("18446744073709551615");
      if (rawSupply > U64_MAX) {
        throw new AppError(
          `Total raw supply (${rawSupply}) exceeds u64 max. ` +
            `Reduce initialSupply or decimals. ` +
            `Max supply with ${decimals} decimals: ${U64_MAX / decimalMultiplier}`,
          400,
        );
      }

      const mintSize = getMintSize();
      const rentLamports = await rpc
        .getMinimumBalanceForRentExemption(BigInt(mintSize))
        .send();

      const [ataAddress] = await findAssociatedTokenPda({
        mint: mintAddress,
        owner: creatorAddress,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      });

      logger.info(`Associated Token Account: ${ataAddress}`);

      const freezeAuth: Address | null = freezeAuthority
        ? creatorAddress
        : null;

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

      const instructions = [
        getCreateAccountInstruction({
          payer: creatorSigner,
          newAccount: mintKeypairSigner,
          lamports: rentLamports,
          space: mintSize,
          programAddress: TOKEN_PROGRAM_ADDRESS,
        }),
        getInitializeMintInstruction({
          mint: mintAddress,
          decimals,
          mintAuthority: creatorAddress,
          freezeAuthority: freezeAuth,
        }),
        getCreateAssociatedTokenIdempotentInstruction({
          payer: creatorSigner,
          owner: creatorAddress,
          mint: mintAddress,
          ata: ataAddress,
        }),
        getMintToInstruction({
          mint: mintAddress,
          token: ataAddress,
          mintAuthority: creatorSigner,
          amount: rawSupply,
        }),
      ];

      const transactionMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (msg) => setTransactionMessageFeePayer(creatorAddress, msg),
        (msg) =>
          setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg),
        (msg) => appendTransactionMessageInstructions(instructions, msg),
      );

      const signedTransaction = await signTransaction(
        [creatorSigner.keyPair, mintKeypairSigner.keyPair],
        compileTransaction(transactionMessage),
      );

      const txSignature = getSignatureFromTransaction(signedTransaction);
      const encodedTransaction =
        getBase64EncodedWireTransaction(signedTransaction);

      await rpc
        .sendTransaction(encodedTransaction, {
          skipPreflight: false,
          maxRetries: BigInt(3),
          encoding: "base64",
        })
        .send();

      logger.info(`Token creation tx sent: ${txSignature}`);

      let confirmed = false;
      for (let i = 0; i < 60; i++) {
        try {
          const statuses = await rpc.getSignatureStatuses([txSignature]).send();
          const status = statuses.value[0];
          if (
            status &&
            (status.confirmationStatus === "confirmed" ||
              status.confirmationStatus === "finalized")
          ) {
            if (status.err) {
              throw new AppError(
                `Token creation failed on-chain: ${JSON.stringify(status.err)}`,
                500,
              );
            }
            confirmed = true;
            break;
          }
        } catch (pollErr: any) {
          if (pollErr instanceof AppError) throw pollErr;
          logger.debug(`Polling error: ${pollErr.message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (!confirmed) {
        logger.warn(
          `Token creation tx ${txSignature} not confirmed within timeout`,
        );
      }

      const record = TokenModel.create({
        mintAddress: mintAddress as string,
        creatorWallet: creatorPublicKey,
        decimals,
        initialSupply: initialSupply.toString(),
        initialSupplyRaw: rawSupply.toString(),
        mintAuthority: creatorPublicKey,
        freezeAuthority: freezeAuthority ? creatorPublicKey : null,
        groupTag,
        txSignature: txSignature as string,
      });

      logger.info(
        `Token created — Mint: ${mintAddress}, Supply: ${initialSupply}, Decimals: ${decimals}`,
      );

      return {
        token: toPublicInfo(record),
        mintAddress: mintAddress as string,
        associatedTokenAccount: ataAddress as string,
        txSignature: txSignature as string,
        initialSupply,
        decimals,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`Failed to create token: ${error.message}`);
      throw new AppError(`Failed to create token: ${error.message}`, 500);
    }
  }

  /**
   * Add metadata to an existing token using Metaplex Token Metadata program
   */
  static async addMetadata(
    options: AddMetadataOptions,
  ): Promise<AddMetadataResult> {
    const { mintAddress, creatorPublicKey, name, symbol, uri } = options;

    try {
      // Verify token exists in our DB
      const tokenRecord = TokenModel.findByMintAddress(mintAddress);
      if (!tokenRecord) {
        throw new AppError(`Token not found in database: ${mintAddress}`, 404);
      }

      // Verify the creator matches
      if (tokenRecord.creator_wallet !== creatorPublicKey) {
        throw new AppError(
          `Wallet ${creatorPublicKey} is not the creator of token ${mintAddress}`,
          403,
        );
      }

      // Check if metadata already exists
      if (tokenRecord.metadata_tx_signature) {
        throw new AppError(
          `Token ${mintAddress} already has metadata attached. ` +
            `Use update-metadata to modify it.`,
          409,
        );
      }

      logger.info(
        `Adding metadata to token ${mintAddress} — name: ${name}, symbol: ${symbol}`,
      );

      // Create UMI instance with the creator's keypair
      const { umi, umiSigner } = createUmiWithSigner(creatorPublicKey);

      const mintPublicKey = umiPublicKey(mintAddress);

      // Find the metadata PDA
      const metadataPda = findMetadataPda(umi, { mint: mintPublicKey });

      // Create metadata account
      const txBuilder = createMetadataAccountV3(umi, {
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

      const metadataTxSignature = bs58.encode(result.signature);

      logger.info(
        `Metadata added to token ${mintAddress} — tx: ${metadataTxSignature}`,
      );

      // Update database
      const updatedRecord = TokenModel.updateMetadata(mintAddress, {
        name,
        symbol,
        uri,
        metadataTxSignature,
      });

      return {
        token: toPublicInfo(updatedRecord!),
        mintAddress,
        metadataTxSignature,
        name,
        symbol,
        uri,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`Failed to add metadata: ${error.message}`);
      throw new AppError(`Failed to add metadata: ${error.message}`, 500);
    }
  }

  /**
   * Create a token AND attach metadata in one flow
   */
  static async createTokenWithMetadata(
    options: CreateTokenWithMetadataOptions,
  ): Promise<CreateTokenWithMetadataResult> {
    const {
      creatorPublicKey,
      decimals,
      initialSupply,
      name,
      symbol,
      uri,
      groupTag,
      freezeAuthority,
    } = options;

    try {
      // Step 1: Create the SPL token
      logger.info(
        `Creating token with metadata — name: ${name}, symbol: ${symbol}`,
      );

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

      logger.info(
        `Token created with metadata — Mint: ${tokenResult.mintAddress}, Name: ${name}, Symbol: ${symbol}`,
      );

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
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`Failed to create token with metadata: ${error.message}`);
      throw new AppError(
        `Failed to create token with metadata: ${error.message}`,
        500,
      );
    }
  }

  /**
   * Get token info by mint address
   */
  static async getToken(mintAddress: string): Promise<TokenPublicInfo> {
    const record = TokenModel.findByMintAddress(mintAddress);
    if (!record) {
      throw new AppError(`Token not found: ${mintAddress}`, 404);
    }
    return toPublicInfo(record);
  }

  /**
   * List tokens with filters
   */
  static async listTokens(options: {
    groupTag?: string;
    creatorWallet?: string;
    page: number;
    limit: number;
  }): Promise<{
    tokens: TokenPublicInfo[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { tokens, total } = TokenModel.list(options);

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
  static async getOnChainMintInfo(mintAddress: string): Promise<{
    mintAddress: string;
    supply: string;
    decimals: number;
    mintAuthority: string | null;
    freezeAuthority: string | null;
    isInitialized: boolean;
  }> {
    try {
      const mintAddr = address(mintAddress);

      const accountInfo = await rpc
        .getAccountInfo(mintAddr, { encoding: "jsonParsed" })
        .send();

      if (!accountInfo.value) {
        throw new AppError(
          `Mint account not found on-chain: ${mintAddress}`,
          404,
        );
      }

      const parsed = (accountInfo.value.data as any)?.parsed;
      if (!parsed || parsed.type !== "mint") {
        throw new AppError(`Account is not a valid mint: ${mintAddress}`, 400);
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
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`Failed to get on-chain mint info: ${error.message}`);
      throw new AppError(`Failed to get mint info: ${error.message}`, 502);
    }
  }

  /**
   * Get on-chain metadata for a token
   */
  static async getOnChainMetadata(mintAddress: string): Promise<{
    mintAddress: string;
    name: string;
    symbol: string;
    uri: string;
    sellerFeeBasisPoints: number;
    creators: Array<{
      address: string;
      verified: boolean;
      share: number;
    }> | null;
    isMutable: boolean;
  }> {
    try {
      const umi = createUmi(config.solana.rpcUrl);
      const mintPublicKey = umiPublicKey(mintAddress);
      const metadataPda = findMetadataPda(umi, { mint: mintPublicKey });

      const accountInfo = await rpc
        .getAccountInfo(address(metadataPda[0] as string), {
          encoding: "jsonParsed",
        })
        .send();

      if (!accountInfo.value) {
        throw new AppError(
          `No metadata found on-chain for token: ${mintAddress}`,
          404,
        );
      }

      // Use UMI to deserialize metadata
      const { fetchMetadataFromSeeds } =
        await import("@metaplex-foundation/mpl-token-metadata");
      const metadata = await fetchMetadataFromSeeds(umi, {
        mint: mintPublicKey,
      });

      return {
        mintAddress,
        name: metadata.name.replace(/\0/g, "").trim(),
        symbol: metadata.symbol.replace(/\0/g, "").trim(),
        uri: metadata.uri.replace(/\0/g, "").trim(),
        sellerFeeBasisPoints: metadata.sellerFeeBasisPoints,
        creators:
          metadata.creators?.__option === "Some"
            ? metadata.creators.value.map((c: any) => ({
                address: c.address.toString(),
                verified: c.verified,
                share: c.share,
              }))
            : null,
        isMutable: metadata.isMutable,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`Failed to get on-chain metadata: ${error.message}`);
      throw new AppError(`Failed to get metadata: ${error.message}`, 502);
    }
  }
}
