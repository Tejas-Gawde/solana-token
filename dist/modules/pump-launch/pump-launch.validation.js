"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBondingCurveSchema = exports.migratePumpSchema = exports.buyPumpSchema = exports.launchPumpWithMintPrivateKeySchema = exports.launchPumpWithBuySchema = exports.launchPumpSchema = void 0;
exports.validate = validate;
const zod_1 = require("zod");
const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
const publicKeySchema = zod_1.z
    .string()
    .min(32, "Invalid public key")
    .max(44, "Invalid public key")
    .regex(base58Regex, "Public key must be valid base58");
const mintPrivateKeySchema = zod_1.z
    .array(zod_1.z
    .number("Each private key value must be a number")
    .int("Each private key value must be an integer")
    .min(0, "Each private key value must be >= 0")
    .max(255, "Each private key value must be <= 255"))
    .length(64, "mintPrivateKey must contain exactly 64 bytes");
exports.launchPumpSchema = zod_1.z.object({
    body: zod_1.z.object({
        creatorPublicKey: publicKeySchema,
        userPublicKey: publicKeySchema,
        name: zod_1.z.string().min(3, "Name must be at least 3 characters").max(32),
        symbol: zod_1.z.string().min(2, "Symbol must be at least 2 characters").max(10),
        uri: zod_1.z.string().min(1, "URI is required").max(512),
        mayhemMode: zod_1.z.boolean().optional().default(false),
        cashback: zod_1.z.boolean().optional().default(false),
    }),
});
exports.launchPumpWithBuySchema = zod_1.z.object({
    body: zod_1.z.object({
        creatorPublicKey: publicKeySchema,
        userPublicKey: publicKeySchema,
        name: zod_1.z.string().min(3, "Name must be at least 3 characters").max(32),
        symbol: zod_1.z.string().min(2, "Symbol must be at least 2 characters").max(10),
        uri: zod_1.z.string().min(1, "URI is required").max(512),
        mayhemMode: zod_1.z.boolean().optional().default(false),
        cashback: zod_1.z.boolean().optional().default(false),
        initialBuySol: zod_1.z
            .number("initialBuySol must be a number")
            .positive("initialBuySol must be greater than 0"),
        slippage: zod_1.z
            .number()
            .min(0, "Slippage must be 0 or greater")
            .max(10, "Slippage cannot exceed 10")
            .optional()
            .default(1),
    }),
});
exports.launchPumpWithMintPrivateKeySchema = zod_1.z.object({
    body: zod_1.z.object({
        creatorPublicKey: publicKeySchema,
        userPublicKey: publicKeySchema,
        name: zod_1.z.string().min(3, "Name must be at least 3 characters").max(32),
        symbol: zod_1.z.string().min(2, "Symbol must be at least 2 characters").max(10),
        uri: zod_1.z.string().min(1, "URI is required").max(512),
        mintPrivateKey: mintPrivateKeySchema,
        mayhemMode: zod_1.z.boolean().optional().default(false),
        cashback: zod_1.z.boolean().optional().default(false),
        initialBuySol: zod_1.z
            .number("initialBuySol must be a number")
            .positive("initialBuySol must be greater than 0")
            .optional(),
        slippage: zod_1.z
            .number()
            .min(0, "Slippage must be 0 or greater")
            .max(10, "Slippage cannot exceed 10")
            .optional()
            .default(1),
    }),
});
exports.buyPumpSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        mintAddress: publicKeySchema,
        userPublicKey: publicKeySchema,
        buySolAmount: zod_1.z
            .number("buySolAmount must be a number")
            .positive("buySolAmount must be greater than 0")
            .optional(),
        buyTokenAmountRaw: zod_1.z
            .string()
            .regex(/^[0-9]+$/, "buyTokenAmountRaw must be a raw token amount string")
            .optional(),
        slippage: zod_1.z
            .number()
            .min(0, "Slippage must be 0 or greater")
            .max(10, "Slippage cannot exceed 10")
            .optional()
            .default(1),
    })
        .superRefine((data, ctx) => {
        if (!data.buySolAmount && !data.buyTokenAmountRaw) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "Either buySolAmount or buyTokenAmountRaw is required",
            });
        }
    }),
});
exports.migratePumpSchema = zod_1.z.object({
    body: zod_1.z.object({
        mintAddress: publicKeySchema,
        userPublicKey: publicKeySchema,
    }),
});
exports.getBondingCurveSchema = zod_1.z.object({
    params: zod_1.z.object({
        mintAddress: publicKeySchema,
    }),
});
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
