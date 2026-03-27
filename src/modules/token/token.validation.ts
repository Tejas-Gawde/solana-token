import { z } from "zod";

const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;

export const createTokenSchema = z.object({
  body: z.object({
    creatorPublicKey: z
      .string()
      .min(32, "Invalid public key")
      .max(44, "Invalid public key")
      .regex(base58Regex, "Public key must be valid base58"),
    decimals: z
      .number()
      .int("Decimals must be an integer")
      .min(0, "Decimals must be at least 0")
      .max(9, "Decimals must be at most 9")
      .optional()
      .default(9),
    initialSupply: z
      .number()
      .min(1, "Initial supply must be at least 1")
      .max(18_446_744_073, "Initial supply too large for 9 decimals"),
    groupTag: z
      .string()
      .max(50, "Group tag must be 50 characters or less")
      .optional(),
    freezeAuthority: z.boolean().optional().default(false),
  }),
});

export const addMetadataSchema = z.object({
  body: z.object({
    mintAddress: z
      .string()
      .min(32, "Invalid mint address")
      .max(44, "Invalid mint address")
      .regex(base58Regex, "Mint address must be valid base58"),
    creatorPublicKey: z
      .string()
      .min(32, "Invalid public key")
      .max(44, "Invalid public key")
      .regex(base58Regex, "Public key must be valid base58"),
    name: z
      .string()
      .min(1, "Token name is required")
      .max(32, "Token name must be 32 characters or less"),
    symbol: z
      .string()
      .min(1, "Token symbol is required")
      .max(10, "Token symbol must be 10 characters or less"),
    uri: z
      .string()
      .min(1, "Metadata URI is required")
      .max(200, "URI must be 200 characters or less")
      .url("URI must be a valid URL"),
  }),
});

export const createTokenWithMetadataSchema = z.object({
  body: z.object({
    creatorPublicKey: z
      .string()
      .min(32, "Invalid public key")
      .max(44, "Invalid public key")
      .regex(base58Regex, "Public key must be valid base58"),
    decimals: z
      .number()
      .int("Decimals must be an integer")
      .min(0, "Decimals must be at least 0")
      .max(9, "Decimals must be at most 9")
      .optional()
      .default(9),
    initialSupply: z
      .number()
      .min(1, "Initial supply must be at least 1")
      .max(18_446_744_073, "Initial supply too large for 9 decimals"),
    name: z
      .string()
      .min(1, "Token name is required")
      .max(32, "Token name must be 32 characters or less"),
    symbol: z
      .string()
      .min(1, "Token symbol is required")
      .max(10, "Token symbol must be 10 characters or less"),
    uri: z
      .string()
      .min(1, "Metadata URI is required")
      .max(200, "URI must be 200 characters or less")
      .url("URI must be a valid URL"),
    groupTag: z
      .string()
      .max(50, "Group tag must be 50 characters or less")
      .optional(),
    freezeAuthority: z.boolean().optional().default(false),
  }),
});

export const getTokenSchema = z.object({
  params: z.object({
    mintAddress: z
      .string()
      .min(32, "Invalid mint address")
      .max(44, "Invalid mint address")
      .regex(base58Regex, "Mint address must be valid base58"),
  }),
});

export const listTokensSchema = z.object({
  query: z.object({
    groupTag: z.string().max(50).optional(),
    creatorWallet: z.string().max(44).optional(),
    page: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().min(1))
      .optional()
      .default(1),
    limit: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().min(1).max(100))
      .optional()
      .default(20),
  }),
});
