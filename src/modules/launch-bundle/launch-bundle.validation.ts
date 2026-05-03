import { z } from "zod";

const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;

const publicKeySchema = z
  .string()
  .min(32, "Invalid public key")
  .max(44, "Invalid public key")
  .regex(base58Regex, "Public key must be valid base58");

const mintPrivateKeySchema = z
  .array(
    z
      .number("Each private key value must be a number")
      .int("Each private key value must be an integer")
      .min(0, "Each private key value must be >= 0")
      .max(255, "Each private key value must be <= 255"),
  )
  .length(64, "mintPrivateKey must contain exactly 64 bytes");

export const launchBundleSchema = z.object({
  body: z.object({
    creatorPublicKey: publicKeySchema,
    userPublicKey: publicKeySchema,
    distributionId: z.string().min(1, "distributionId is required"),
    name: z.string().min(3, "Name must be at least 3 characters").max(32),
    symbol: z.string().min(2, "Symbol must be at least 2 characters").max(10),
    uri: z.string().min(1, "URI is required").max(512),
    mintPrivateKey: mintPrivateKeySchema.optional(),
    mayhemMode: z.boolean().optional().default(false),
    cashback: z.boolean().optional().default(false),
    jitoTipSol: z
      .number("jitoTipSol must be a number")
      .min(0.0001, "jitoTipSol must be at least 0.0001")
      .max(1, "jitoTipSol cannot exceed 1")
      .optional()
      .default(0.001),
    buyers: z
      .array(
        z.object({
          walletPublicKey: publicKeySchema,
          buySolAmount: z
            .number("buySolAmount must be a number")
            .positive("buySolAmount must be greater than 0")
            .max(100, "buySolAmount cannot exceed 100"),
          slippage: z
            .number("slippage must be a number")
            .min(0, "Slippage must be 0 or greater")
            .max(10, "Slippage cannot exceed 10")
            .optional()
            .default(1),
        }),
      )
      .min(1, "At least one buyer is required")
      .max(20, "Maximum 20 buyer wallets per bundle"),
  }),
});

export const launchBundleDirectWalletsSchema = z.object({
  body: z.object({
    creatorPublicKey: publicKeySchema,
    userPublicKey: publicKeySchema,
    name: z.string().min(3, "Name must be at least 3 characters").max(32),
    symbol: z.string().min(2, "Symbol must be at least 2 characters").max(10),
    uri: z.string().min(1, "URI is required").max(512),
    mintPrivateKey: mintPrivateKeySchema.optional(),
    mayhemMode: z.boolean().optional().default(false),
    cashback: z.boolean().optional().default(false),
    jitoTipSol: z
      .number("jitoTipSol must be a number")
      .min(0.0001, "jitoTipSol must be at least 0.0001")
      .max(1, "jitoTipSol cannot exceed 1")
      .optional()
      .default(0.001),
    buyers: z
      .array(
        z.object({
          walletPublicKey: publicKeySchema,
          buySolAmount: z
            .number("buySolAmount must be a number")
            .positive("buySolAmount must be greater than 0")
            .max(100, "buySolAmount cannot exceed 100"),
          slippage: z
            .number("slippage must be a number")
            .min(0, "Slippage must be 0 or greater")
            .max(10, "Slippage cannot exceed 10")
            .optional()
            .default(1),
        }),
      )
      .min(1, "At least one buyer is required")
      .max(20, "Maximum 20 buyer wallets per bundle"),
  }),
});

export const getLaunchBundleSchema = z.object({
  params: z.object({
    launchBundleId: z.string().min(1, "launchBundleId is required"),
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
