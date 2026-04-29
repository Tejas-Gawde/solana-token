"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTokensSchema = exports.getTokenSchema = exports.createTokenWithMetadataSchema = exports.addMetadataSchema = exports.createTokenSchema = void 0;
const zod_1 = require("zod");
const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
exports.createTokenSchema = zod_1.z.object({
    body: zod_1.z.object({
        creatorPublicKey: zod_1.z
            .string()
            .min(32, "Invalid public key")
            .max(44, "Invalid public key")
            .regex(base58Regex, "Public key must be valid base58"),
        decimals: zod_1.z
            .number()
            .int("Decimals must be an integer")
            .min(0, "Decimals must be at least 0")
            .max(9, "Decimals must be at most 9")
            .optional()
            .default(9),
        initialSupply: zod_1.z
            .number()
            .min(1, "Initial supply must be at least 1")
            .max(18446744073, "Initial supply too large for 9 decimals"),
        groupTag: zod_1.z
            .string()
            .max(50, "Group tag must be 50 characters or less")
            .optional(),
        freezeAuthority: zod_1.z.boolean().optional().default(false),
    }),
});
exports.addMetadataSchema = zod_1.z.object({
    body: zod_1.z.object({
        mintAddress: zod_1.z
            .string()
            .min(32, "Invalid mint address")
            .max(44, "Invalid mint address")
            .regex(base58Regex, "Mint address must be valid base58"),
        creatorPublicKey: zod_1.z
            .string()
            .min(32, "Invalid public key")
            .max(44, "Invalid public key")
            .regex(base58Regex, "Public key must be valid base58"),
        name: zod_1.z
            .string()
            .min(1, "Token name is required")
            .max(32, "Token name must be 32 characters or less"),
        symbol: zod_1.z
            .string()
            .min(1, "Token symbol is required")
            .max(10, "Token symbol must be 10 characters or less"),
        uri: zod_1.z
            .string()
            .min(1, "Metadata URI is required")
            .max(200, "URI must be 200 characters or less")
            .url("URI must be a valid URL"),
    }),
});
exports.createTokenWithMetadataSchema = zod_1.z.object({
    body: zod_1.z.object({
        creatorPublicKey: zod_1.z
            .string()
            .min(32, "Invalid public key")
            .max(44, "Invalid public key")
            .regex(base58Regex, "Public key must be valid base58"),
        decimals: zod_1.z
            .number()
            .int("Decimals must be an integer")
            .min(0, "Decimals must be at least 0")
            .max(9, "Decimals must be at most 9")
            .optional()
            .default(9),
        initialSupply: zod_1.z
            .number()
            .min(1, "Initial supply must be at least 1")
            .max(18446744073, "Initial supply too large for 9 decimals"),
        name: zod_1.z
            .string()
            .min(1, "Token name is required")
            .max(32, "Token name must be 32 characters or less"),
        symbol: zod_1.z
            .string()
            .min(1, "Token symbol is required")
            .max(10, "Token symbol must be 10 characters or less"),
        uri: zod_1.z
            .string()
            .min(1, "Metadata URI is required")
            .max(200, "URI must be 200 characters or less")
            .url("URI must be a valid URL"),
        groupTag: zod_1.z
            .string()
            .max(50, "Group tag must be 50 characters or less")
            .optional(),
        freezeAuthority: zod_1.z.boolean().optional().default(false),
    }),
});
exports.getTokenSchema = zod_1.z.object({
    params: zod_1.z.object({
        mintAddress: zod_1.z
            .string()
            .min(32, "Invalid mint address")
            .max(44, "Invalid mint address")
            .regex(base58Regex, "Mint address must be valid base58"),
    }),
});
exports.listTokensSchema = zod_1.z.object({
    query: zod_1.z.object({
        groupTag: zod_1.z.string().max(50).optional(),
        creatorWallet: zod_1.z.string().max(44).optional(),
        page: zod_1.z
            .string()
            .transform((val) => parseInt(val, 10))
            .pipe(zod_1.z.number().int().min(1))
            .optional()
            .default(1),
        limit: zod_1.z
            .string()
            .transform((val) => parseInt(val, 10))
            .pipe(zod_1.z.number().int().min(1).max(100))
            .optional()
            .default(20),
    }),
});
