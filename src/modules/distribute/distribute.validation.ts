import { z } from "zod";

const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;

export const distributeSchema = z.object({
  body: z.object({
    mainWalletPublicKey: z
      .string()
      .min(32)
      .max(44)
      .regex(base58Regex, "Invalid base58 public key"),
    numWallets: z
      .number()
      .int("Must be an integer")
      .min(1, "Must distribute to at least 1 wallet")
      .max(20, "Maximum 20 wallets per distribution"),
    solPerWallet: z
      .number()
      .min(0.005, "Minimum 0.005 SOL per wallet")
      .max(100, "Maximum 100 SOL per wallet"),
    groupTag: z
      .string()
      .max(50)
      .optional(),
  }),
});

export const getDistributionSchema = z.object({
  params: z.object({
    distributionId: z
      .string()
      .min(1, "Distribution ID is required"),
  }),
});

export const listDistributionsSchema = z.object({
  query: z.object({
    groupTag: z.string().max(50).optional(),
    mainWallet: z.string().max(44).optional(),
    status: z.enum(["completed", "pending", "failed"]).optional(),
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