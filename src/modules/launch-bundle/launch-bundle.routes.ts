import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.ts";
import { LaunchBundleController } from "./launch-bundle.controller.ts";
import {
  getLaunchBundleSchema,
  launchBundleDirectWalletsSchema,
  launchBundleSchema,
  validate,
} from "./launch-bundle.validation.ts";

const router = Router();

router.post(
  "/launch",
  validate(launchBundleSchema),
  asyncHandler(LaunchBundleController.launch),
);

router.post(
  "/launch-direct-wallets",
  validate(launchBundleDirectWalletsSchema),
  asyncHandler(LaunchBundleController.launchWithWallets),
);

router.get(
  "/:launchBundleId",
  validate(getLaunchBundleSchema),
  asyncHandler(LaunchBundleController.getLaunchBundle),
);

export default router;
