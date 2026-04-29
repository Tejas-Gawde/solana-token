"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const distribute_controller_ts_1 = require("./distribute.controller.ts");
const asyncHandler_ts_1 = require("../../middleware/asyncHandler.ts");
const wallet_validation_ts_1 = require("../wallet/wallet.validation.ts");
const distribute_validation_ts_1 = require("./distribute.validation.ts");
const router = (0, express_1.Router)();
/**
 * POST /api/distribute
 * Distribute SOL from main wallet to C wallets via obfuscated path
 */
router.post("/", (0, wallet_validation_ts_1.validate)(distribute_validation_ts_1.distributeSchema), (0, asyncHandler_ts_1.asyncHandler)(distribute_controller_ts_1.DistributeController.distribute));
/**
 * GET /api/distribute
 * List all distributions
 */
router.get("/", (0, wallet_validation_ts_1.validate)(distribute_validation_ts_1.listDistributionsSchema), (0, asyncHandler_ts_1.asyncHandler)(distribute_controller_ts_1.DistributeController.listDistributions));
/**
 * GET /api/distribute/:distributionId
 * Get distribution details
 */
router.get("/:distributionId", (0, wallet_validation_ts_1.validate)(distribute_validation_ts_1.getDistributionSchema), (0, asyncHandler_ts_1.asyncHandler)(distribute_controller_ts_1.DistributeController.getDistribution));
/**
 * GET /api/distribute/:distributionId/wallets
 * Get destination (C) wallets for a distribution
 */
router.get("/:distributionId/wallets", (0, wallet_validation_ts_1.validate)(distribute_validation_ts_1.getDistributionSchema), (0, asyncHandler_ts_1.asyncHandler)(distribute_controller_ts_1.DistributeController.getDestinationWallets));
exports.default = router;
