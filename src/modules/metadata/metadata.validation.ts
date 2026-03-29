import { z } from "zod";

export const createMetadataWithUploadSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, "Token name is required")
      .max(32, "Token name must be 32 characters or less"),
    symbol: z
      .string()
      .min(1, "Token symbol is required")
      .max(10, "Token symbol must be 10 characters or less"),
    description: z
      .string()
      .max(500, "Description must be 500 characters or less")
      .optional()
      .default(""),
    showName: z
      .string()
      .transform((val) => val === "true")
      .optional()
      .default(true),
    createdOn: z.string().max(200).optional().default("https://pump.fun"),
    twitter: z.string().max(200).optional(),
    telegram: z.string().max(200).optional(),
    website: z.string().max(200).optional(),
    groupTag: z.string().max(50).optional(),
  }),
});

export const createMetadataWithUrlSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, "Token name is required")
      .max(32, "Token name must be 32 characters or less"),
    symbol: z
      .string()
      .min(1, "Token symbol is required")
      .max(10, "Token symbol must be 10 characters or less"),
    description: z
      .string()
      .max(500, "Description must be 500 characters or less")
      .optional()
      .default(""),
    imageUrl: z
      .string()
      .min(1, "Image URL is required")
      .max(500)
      .url("Must be a valid URL"),
    showName: z.boolean().optional().default(true),
    createdOn: z.string().max(200).optional().default("https://pump.fun"),
    twitter: z.string().max(200).optional(),
    telegram: z.string().max(200).optional(),
    website: z.string().max(200).optional(),
    groupTag: z.string().max(50).optional(),
  }),
});

export const getMetadataSchema = z.object({
  params: z.object({
    metadataId: z.string().min(1, "Metadata ID is required"),
  }),
});

export const listMetadataSchema = z.object({
  query: z.object({
    groupTag: z.string().max(50).optional(),
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
