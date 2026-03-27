import { z } from "zod";

const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;

export const generateWalletSchema = z.object({
  body: z.object({
    groupTag: z
      .string()
      .max(50, "Group tag must be 50 characters or less")
      .optional(),
  }),
});

export const batchGenerateSchema = z.object({
  body: z.object({
    count: z
      .number()
      .int("Count must be an integer")
      .min(1, "Must generate at least 1 wallet")
      .max(50, "Cannot generate more than 50 wallets at once"),
    groupTag: z
      .string()
      .max(50, "Group tag must be 50 characters or less")
      .optional(),
  }),
});

export const importWalletSchema = z.object({
  body: z.object({
    privateKeyBase58: z
      .string()
      .min(32, "Invalid private key length")
      .max(128, "Invalid private key length")
      .regex(base58Regex, "Private key must be valid base58"),
    groupTag: z
      .string()
      .max(50, "Group tag must be 50 characters or less")
      .optional(),
  }),
});

export const fundWalletSchema = z.object({
  body: z.object({
    publicKey: z
      .string()
      .min(32, "Invalid public key")
      .max(44, "Invalid public key")
      .regex(base58Regex, "Public key must be valid base58"),
    amountSol: z
      .number()
      .min(0.001, "Minimum airdrop is 0.001 SOL")
      .max(1, "Maximum reliable devnet airdrop is 1 SOL per request")
      .optional()
      .default(1),
  }),
});

export const exportPrivateKeySchema = z.object({
  params: z.object({
    publicKey: z
      .string()
      .min(32, "Invalid public key")
      .max(44, "Invalid public key")
      .regex(base58Regex, "Public key must be valid base58"),
  }),
});

export const getWalletSchema = z.object({
  params: z.object({
    publicKey: z
      .string()
      .min(32, "Invalid public key")
      .max(44, "Invalid public key"),
  }),
});

export const listWalletsSchema = z.object({
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

export const batchExportSchema = z.object({
  params: z.object({
    groupTag: z
      .string()
      .min(1, "Group tag is required")
      .max(50, "Group tag must be 50 characters or less"),
  }),
});

/**
 * Middleware-style validator factory
 */
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
