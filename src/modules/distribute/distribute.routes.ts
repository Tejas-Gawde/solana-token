import { Router } from "express";
import { DistributeController } from "./distribute.controller.ts";
import { asyncHandler } from "../../middleware/asyncHandler.ts";
import { validate } from "../wallet/wallet.validation.ts";
import {
  distributeSchema,
  getDistributionSchema,
  listDistributionsSchema,
} from "./distribute.validation.ts";

const router = Router();

/**
 * POST /api/distribute
 * Distribute SOL from main wallet to C wallets via obfuscated path
 */
router.post(
  "/",
  validate(distributeSchema),
  asyncHandler(DistributeController.distribute)
);

/**
 * GET /api/distribute
 * List all distributions
 */
router.get(
  "/",
  validate(listDistributionsSchema),
  asyncHandler(DistributeController.listDistributions)
);

/**
 * GET /api/distribute/:distributionId
 * Get distribution details
 */
router.get(
  "/:distributionId",
  validate(getDistributionSchema),
  asyncHandler(DistributeController.getDistribution)
);

/**
 * GET /api/distribute/:distributionId/wallets
 * Get destination (C) wallets for a distribution
 */
router.get(
  "/:distributionId/wallets",
  validate(getDistributionSchema),
  asyncHandler(DistributeController.getDestinationWallets)
);

export default router;