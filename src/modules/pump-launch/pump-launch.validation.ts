import { z } from "zod";

const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;

const publicKeySchema = z
  .string()
  .min(32, "Invalid public key")
  .max(44, "Invalid public key")
  .regex(base58Regex, "Public key must be valid base58");

export const launchPumpSchema = z.object({
  body: z.object({
    creatorPublicKey: publicKeySchema,
    userPublicKey: publicKeySchema,
    name: z.string().min(3, "Name must be at least 3 characters").max(32),
    symbol: z.string().min(2, "Symbol must be at least 2 characters").max(10),
    uri: z.string().min(1, "URI is required").max(512),
    mayhemMode: z.boolean().optional().default(false),
    cashback: z.boolean().optional().default(false),
  }),
});

export const launchPumpWithBuySchema = z.object({
  body: z.object({
    creatorPublicKey: publicKeySchema,
    userPublicKey: publicKeySchema,
    name: z.string().min(3, "Name must be at least 3 characters").max(32),
    symbol: z.string().min(2, "Symbol must be at least 2 characters").max(10),
    uri: z.string().min(1, "URI is required").max(512),
    mayhemMode: z.boolean().optional().default(false),
    cashback: z.boolean().optional().default(false),
    initialBuySol: z
      .number("initialBuySol must be a number")
      .positive("initialBuySol must be greater than 0"),
    slippage: z
      .number()
      .min(0, "Slippage must be 0 or greater")
      .max(10, "Slippage cannot exceed 10")
      .optional()
      .default(1),
  }),
});

export const buyPumpSchema = z.object({
  body: z
    .object({
      mintAddress: publicKeySchema,
      userPublicKey: publicKeySchema,
      buySolAmount: z
        .number("buySolAmount must be a number")
        .positive("buySolAmount must be greater than 0")
        .optional(),
      buyTokenAmountRaw: z
        .string()
        .regex(
          /^[0-9]+$/,
          "buyTokenAmountRaw must be a raw token amount string",
        )
        .optional(),
      slippage: z
        .number()
        .min(0, "Slippage must be 0 or greater")
        .max(10, "Slippage cannot exceed 10")
        .optional()
        .default(1),
    })
    .superRefine((data, ctx) => {
      if (!data.buySolAmount && !data.buyTokenAmountRaw) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Either buySolAmount or buyTokenAmountRaw is required",
        });
      }
    }),
});

export const migratePumpSchema = z.object({
  body: z.object({
    mintAddress: publicKeySchema,
    userPublicKey: publicKeySchema,
  }),
});

export const getBondingCurveSchema = z.object({
  params: z.object({
    mintAddress: publicKeySchema,
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
