"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMetadataSchema = exports.getMetadataSchema = exports.createMetadataWithUrlSchema = exports.createMetadataWithUploadSchema = void 0;
const zod_1 = require("zod");
exports.createMetadataWithUploadSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z
            .string()
            .min(1, "Token name is required")
            .max(32, "Token name must be 32 characters or less"),
        symbol: zod_1.z
            .string()
            .min(1, "Token symbol is required")
            .max(10, "Token symbol must be 10 characters or less"),
        description: zod_1.z
            .string()
            .max(500, "Description must be 500 characters or less")
            .optional()
            .default(""),
        showName: zod_1.z
            .string()
            .transform((val) => val === "true")
            .optional()
            .default(true),
        createdOn: zod_1.z.string().max(200).optional().default("https://pump.fun"),
        twitter: zod_1.z.string().max(200).optional(),
        telegram: zod_1.z.string().max(200).optional(),
        website: zod_1.z.string().max(200).optional(),
        groupTag: zod_1.z.string().max(50).optional(),
    }),
});
exports.createMetadataWithUrlSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z
            .string()
            .min(1, "Token name is required")
            .max(32, "Token name must be 32 characters or less"),
        symbol: zod_1.z
            .string()
            .min(1, "Token symbol is required")
            .max(10, "Token symbol must be 10 characters or less"),
        description: zod_1.z
            .string()
            .max(500, "Description must be 500 characters or less")
            .optional()
            .default(""),
        imageUrl: zod_1.z
            .string()
            .min(1, "Image URL is required")
            .max(500)
            .url("Must be a valid URL"),
        showName: zod_1.z.boolean().optional().default(true),
        createdOn: zod_1.z.string().max(200).optional().default("https://pump.fun"),
        twitter: zod_1.z.string().max(200).optional(),
        telegram: zod_1.z.string().max(200).optional(),
        website: zod_1.z.string().max(200).optional(),
        groupTag: zod_1.z.string().max(50).optional(),
    }),
});
exports.getMetadataSchema = zod_1.z.object({
    params: zod_1.z.object({
        metadataId: zod_1.z.string().min(1, "Metadata ID is required"),
    }),
});
exports.listMetadataSchema = zod_1.z.object({
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
