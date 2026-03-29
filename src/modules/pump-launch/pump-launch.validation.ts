import { z } from "zod";

const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;

export const createPumpLaunchSchema = z.object({
  body: z.object({
    creatorWallet: z
      .string()
      .min(32, "Invalid creator wallet public key")
      .max(44, "Invalid creator wallet public key")
      .regex(base58Regex, "Creator wallet must be valid base58"),
    name: z.string().min(1, "Name is required").max(32, "Name max 32 chars"),
    symbol: z
      .string()
      .min(1, "Symbol is required")
      .max(10, "Symbol max 10 chars"),
    description: z.string().max(512, "Description max 512 chars").optional(),
    imageUrl: z.string().url("Image URL must be a valid URL"),
    metadataUri: z.string().url("Metadata URI must be a valid URL").optional(),
    twitter: z.string().max(100, "Twitter link max 100 chars").optional(),
    telegram: z.string().max(100, "Telegram link max 100 chars").optional(),
    website: z.string().url("Website must be a valid URL").optional(),
    initialBuySol: z.number().gt(0, "Initial buy amount must be >0").optional(),
    groupTag: z.string().max(50, "Group tag max 50 chars").optional(),
    mayhemMode: z.boolean().optional().default(false),
    cashback: z.boolean().optional().default(false),
  }),
});

export const getPumpLaunchSchema = z.object({
  params: z.object({
    mintAddress: z
      .string()
      .min(32, "Invalid mint address")
      .max(44, "Invalid mint address")
      .regex(base58Regex, "Mint address must be valid base58"),
  }),
});

export const listPumpLaunchesSchema = z.object({
  query: z.object({
    creatorWallet: z
      .string()
      .max(44, "Invalid creator wallet public key")
      .regex(base58Regex, "Creator wallet must be valid base58")
      .optional(),
    status: z.string().optional(),
    groupTag: z.string().max(50, "Group tag max 50 chars").optional(),
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

export const updatePumpLaunchSchema = z.object({
  params: z.object({
    mintAddress: z
      .string()
      .min(32, "Invalid mint address")
      .max(44, "Invalid mint address")
      .regex(base58Regex, "Mint address must be valid base58"),
  }),
  body: z.object({
    status: z
      .enum(["pending", "created", "failed", "active", "cancelled"])
      .optional(),
    description: z.string().max(512).optional(),
    imageUrl: z.string().url().optional(),
    metadataUri: z.string().url().optional(),
    twitter: z.string().max(100).optional(),
    telegram: z.string().max(100).optional(),
    website: z.string().url().optional(),
    initialBuySol: z.number().gt(0).optional(),
    groupTag: z.string().max(50).optional(),
  }),
});

export const executePumpLaunchSchema = z.object({
  params: z.object({
    mintAddress: z
      .string()
      .min(32, "Invalid mint address")
      .max(44, "Invalid mint address")
      .regex(base58Regex, "Mint address must be valid base58"),
  }),
});

export function validate(schema: z.ZodObject<any>) {
  return (req: any, _res: any, next: any) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      throw result.error;
    }

    if (result.data.body) req.body = result.data.body;
    if (result.data.params) req.params = result.data.params;
    if (result.data.query) Object.assign(req.query, result.data.query);

    next();
  };
}
