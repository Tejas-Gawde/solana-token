import { Router } from "express";
import { PumpLaunchController } from "./pump-launch.controller.ts";
import { asyncHandler } from "../../middleware/asyncHandler.ts";
import {
  validate,
  launchPumpSchema,
  launchPumpWithBuySchema,
  launchPumpWithMintPrivateKeySchema,
  buyPumpSchema,
  migratePumpSchema,
  getBondingCurveSchema,
} from "./pump-launch.validation.ts";

const router = Router();

/**
 * POST /api/pump-launch/launch
 * Launch a new pump without initial buy.
 */
router.post(
  "/launch",
  validate(launchPumpSchema),
  asyncHandler(PumpLaunchController.launch),
);

/**
 * POST /api/pump-launch/launch-with-buy
 * Launch a new pump and perform an initial buy in the same request.
 */
router.post(
  "/launch-with-buy",
  validate(launchPumpWithBuySchema),
  asyncHandler(PumpLaunchController.launchWithBuy),
);

/**
 * POST /api/pump-launch/launch-with-mint-private-key
 * Launch a new pump using a caller-provided mint private key.
 */
router.post(
  "/launch-with-mint-private-key",
  validate(launchPumpWithMintPrivateKeySchema),
  asyncHandler(PumpLaunchController.launchWithMintPrivateKey),
);

/**
 * POST /api/pump-launch/buy
 * Execute a buy order against an existing pump.
 */
router.post(
  "/buy",
  validate(buyPumpSchema),
  asyncHandler(PumpLaunchController.buy),
);

/**
 * POST /api/pump-launch/migrate
 * Migrate a pump instance to a new configuration or market.
 */
router.post(
  "/migrate",
  validate(migratePumpSchema),
  asyncHandler(PumpLaunchController.migrate),
);

/**
 * GET /api/pump-launch/bonding-curve/:mintAddress
 * Retrieve bonding curve data for a pump by mint address.
 */
router.get(
  "/bonding-curve/:mintAddress",
  validate(getBondingCurveSchema),
  asyncHandler(PumpLaunchController.getBondingCurve),
);

export default router;
