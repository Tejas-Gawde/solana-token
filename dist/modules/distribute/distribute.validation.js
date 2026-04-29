"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDistributionsSchema = exports.getDistributionSchema = exports.distributeSchema = void 0;
const zod_1 = require("zod");
const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
exports.distributeSchema = zod_1.z.object({
    body: zod_1.z.object({
        mainWalletPublicKey: zod_1.z
            .string()
            .min(32)
            .max(44)
            .regex(base58Regex, "Invalid base58 public key"),
        numWallets: zod_1.z
            .number()
            .int("Must be an integer")
            .min(1, "Must distribute to at least 1 wallet")
            .max(20, "Maximum 20 wallets per distribution"),
        solPerWallet: zod_1.z
            .number()
            .min(0.005, "Minimum 0.005 SOL per wallet")
            .max(100, "Maximum 100 SOL per wallet"),
        groupTag: zod_1.z
            .string()
            .max(50)
            .optional(),
    }),
});
exports.getDistributionSchema = zod_1.z.object({
    params: zod_1.z.object({
        distributionId: zod_1.z
            .string()
            .min(1, "Distribution ID is required"),
    }),
});
exports.listDistributionsSchema = zod_1.z.object({
    query: zod_1.z.object({
        groupTag: zod_1.z.string().max(50).optional(),
        mainWallet: zod_1.z.string().max(44).optional(),
        status: zod_1.z.enum(["completed", "pending", "failed"]).optional(),
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
