"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pump_launch_controller_ts_1 = require("./pump-launch.controller.ts");
const asyncHandler_ts_1 = require("../../middleware/asyncHandler.ts");
const pump_launch_validation_ts_1 = require("./pump-launch.validation.ts");
const router = (0, express_1.Router)();
/**
 * POST /api/pump-launch/launch
 * Launch a new pump without initial buy.
 */
router.post("/launch", (0, pump_launch_validation_ts_1.validate)(pump_launch_validation_ts_1.launchPumpSchema), (0, asyncHandler_ts_1.asyncHandler)(pump_launch_controller_ts_1.PumpLaunchController.launch));
/**
 * POST /api/pump-launch/launch-with-buy
 * Launch a new pump and perform an initial buy in the same request.
 */
router.post("/launch-with-buy", (0, pump_launch_validation_ts_1.validate)(pump_launch_validation_ts_1.launchPumpWithBuySchema), (0, asyncHandler_ts_1.asyncHandler)(pump_launch_controller_ts_1.PumpLaunchController.launchWithBuy));
/**
 * POST /api/pump-launch/launch-with-mint-private-key
 * Launch a new pump using a caller-provided mint private key.
 */
router.post("/launch-with-mint-private-key", (0, pump_launch_validation_ts_1.validate)(pump_launch_validation_ts_1.launchPumpWithMintPrivateKeySchema), (0, asyncHandler_ts_1.asyncHandler)(pump_launch_controller_ts_1.PumpLaunchController.launchWithMintPrivateKey));
/**
 * POST /api/pump-launch/buy
 * Execute a buy order against an existing pump.
 */
router.post("/buy", (0, pump_launch_validation_ts_1.validate)(pump_launch_validation_ts_1.buyPumpSchema), (0, asyncHandler_ts_1.asyncHandler)(pump_launch_controller_ts_1.PumpLaunchController.buy));
/**
 * POST /api/pump-launch/migrate
 * Migrate a pump instance to a new configuration or market.
 */
router.post("/migrate", (0, pump_launch_validation_ts_1.validate)(pump_launch_validation_ts_1.migratePumpSchema), (0, asyncHandler_ts_1.asyncHandler)(pump_launch_controller_ts_1.PumpLaunchController.migrate));
/**
 * GET /api/pump-launch/bonding-curve/:mintAddress
 * Retrieve bonding curve data for a pump by mint address.
 */
router.get("/bonding-curve/:mintAddress", (0, pump_launch_validation_ts_1.validate)(pump_launch_validation_ts_1.getBondingCurveSchema), (0, asyncHandler_ts_1.asyncHandler)(pump_launch_controller_ts_1.PumpLaunchController.getBondingCurve));
exports.default = router;
