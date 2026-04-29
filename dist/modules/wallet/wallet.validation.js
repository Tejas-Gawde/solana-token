"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchExportSchema = exports.listWalletsSchema = exports.getWalletSchema = exports.exportPrivateKeySchema = exports.fundWalletSchema = exports.importWalletSchema = exports.batchGenerateSchema = exports.generateWalletSchema = void 0;
exports.validate = validate;
const zod_1 = require("zod");
const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
exports.generateWalletSchema = zod_1.z.object({
    body: zod_1.z.object({
        groupTag: zod_1.z
            .string()
            .max(50, "Group tag must be 50 characters or less")
            .optional(),
    }),
});
exports.batchGenerateSchema = zod_1.z.object({
    body: zod_1.z.object({
        count: zod_1.z
            .number()
            .int("Count must be an integer")
            .min(1, "Must generate at least 1 wallet")
            .max(50, "Cannot generate more than 50 wallets at once"),
        groupTag: zod_1.z
            .string()
            .max(50, "Group tag must be 50 characters or less")
            .optional(),
    }),
});
exports.importWalletSchema = zod_1.z.object({
    body: zod_1.z.object({
        privateKeyBase58: zod_1.z
            .string()
            .min(32, "Invalid private key length")
            .max(128, "Invalid private key length")
            .regex(base58Regex, "Private key must be valid base58"),
        groupTag: zod_1.z
            .string()
            .max(50, "Group tag must be 50 characters or less")
            .optional(),
    }),
});
exports.fundWalletSchema = zod_1.z.object({
    body: zod_1.z.object({
        publicKey: zod_1.z
            .string()
            .min(32, "Invalid public key")
            .max(44, "Invalid public key")
            .regex(base58Regex, "Public key must be valid base58"),
        amountSol: zod_1.z
            .number()
            .min(0.001, "Minimum airdrop is 0.001 SOL")
            .max(1, "Maximum reliable devnet airdrop is 1 SOL per request")
            .optional()
            .default(1),
    }),
});
exports.exportPrivateKeySchema = zod_1.z.object({
    params: zod_1.z.object({
        publicKey: zod_1.z
            .string()
            .min(32, "Invalid public key")
            .max(44, "Invalid public key")
            .regex(base58Regex, "Public key must be valid base58"),
    }),
});
exports.getWalletSchema = zod_1.z.object({
    params: zod_1.z.object({
        publicKey: zod_1.z
            .string()
            .min(32, "Invalid public key")
            .max(44, "Invalid public key"),
    }),
});
exports.listWalletsSchema = zod_1.z.object({
    query: zod_1.z.object({
        groupTag: zod_1.z.string().max(50).optional(),
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
exports.batchExportSchema = zod_1.z.object({
    params: zod_1.z.object({
        groupTag: zod_1.z
            .string()
            .min(1, "Group tag is required")
            .max(50, "Group tag must be 50 characters or less"),
    }),
});
/**
 * Middleware-style validator factory
 */
function validate(schema) {
    return (req, _res, next) => {
        const result = schema.safeParse({
            body: req.body,
            params: req.params,
            query: req.query,
        });
        if (!result.success) {
            throw result.error;
        }
        if (result.data.body)
            req.body = result.data.body;
        if (result.data.params)
            req.params = result.data.params;
        if (result.data.query)
            Object.assign(req.query, result.data.query);
        next();
    };
}
