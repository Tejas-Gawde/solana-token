import { Router } from "express";
import { PumpLaunchController } from "./pump-launch.controller.ts";
import { asyncHandler } from "../../middleware/asyncHandler.ts";
import {
  validate,
  createPumpLaunchSchema,
  listPumpLaunchesSchema,
  getPumpLaunchSchema,
  updatePumpLaunchSchema,
  executePumpLaunchSchema,
} from "./pump-launch.validation.ts";

const router = Router();

// ==================== PUMP LAUNCH ROUTES ====================

/**
 * POST /api/pump-launches
 */
router.post(
  "/",
  validate(createPumpLaunchSchema),
  asyncHandler(PumpLaunchController.createLaunch),
);

/**
 * GET /api/pump-launches
 */
router.get(
  "/",
  validate(listPumpLaunchesSchema),
  asyncHandler(PumpLaunchController.listLaunches),
);

/**
 * GET /api/pump-launches/:mintAddress
 */
router.get(
  "/:mintAddress",
  validate(getPumpLaunchSchema),
  asyncHandler(PumpLaunchController.getLaunch),
);

/**
 * PATCH /api/pump-launches/:mintAddress
 */
router.patch(
  "/:mintAddress",
  validate(updatePumpLaunchSchema),
  asyncHandler(PumpLaunchController.updateLaunch),
);

/**
 * POST /api/pump-launches/:mintAddress/execute
 */
// Deprecated: No need to use this endpoint anymore since pump launch is executed immediately after creation
router.post(
  "/:mintAddress/execute",
  validate(executePumpLaunchSchema),
  asyncHandler(PumpLaunchController.executeLaunch),
);

export default router;
