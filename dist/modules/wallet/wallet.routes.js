"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wallet_controller_ts_1 = require("./wallet.controller.ts");
const asyncHandler_ts_1 = require("../../middleware/asyncHandler.ts");
const wallet_validation_ts_1 = require("./wallet.validation.ts");
const router = (0, express_1.Router)();
// ==================== WALLET ROUTES ====================
/**
 * POST /api/wallets/generate
 */
router.post("/generate", (0, wallet_validation_ts_1.validate)(wallet_validation_ts_1.generateWalletSchema), (0, asyncHandler_ts_1.asyncHandler)(wallet_controller_ts_1.WalletController.generate));
/**
 * POST /api/wallets/batch-generate
 */
router.post("/batch-generate", (0, wallet_validation_ts_1.validate)(wallet_validation_ts_1.batchGenerateSchema), (0, asyncHandler_ts_1.asyncHandler)(wallet_controller_ts_1.WalletController.batchGenerate));
/**
 * POST /api/wallets/import
 */
router.post("/import", (0, wallet_validation_ts_1.validate)(wallet_validation_ts_1.importWalletSchema), (0, asyncHandler_ts_1.asyncHandler)(wallet_controller_ts_1.WalletController.importWallet));
/**
 * POST /api/wallets/fund
 */
router.post("/fund", (0, wallet_validation_ts_1.validate)(wallet_validation_ts_1.fundWalletSchema), (0, asyncHandler_ts_1.asyncHandler)(wallet_controller_ts_1.WalletController.fundWallet));
/**
 * GET /api/wallets/batch-export/:groupTag
 * ⚠️ Must be BEFORE /:publicKey to avoid route conflict
 */
router.get("/batch-export/:groupTag", (0, wallet_validation_ts_1.validate)(wallet_validation_ts_1.batchExportSchema), (0, asyncHandler_ts_1.asyncHandler)(wallet_controller_ts_1.WalletController.batchExport));
/**
 * GET /api/wallets
 */
router.get("/", (0, wallet_validation_ts_1.validate)(wallet_validation_ts_1.listWalletsSchema), (0, asyncHandler_ts_1.asyncHandler)(wallet_controller_ts_1.WalletController.listWallets));
/**
 * GET /api/wallets/:publicKey
 */
router.get("/:publicKey", (0, wallet_validation_ts_1.validate)(wallet_validation_ts_1.getWalletSchema), (0, asyncHandler_ts_1.asyncHandler)(wallet_controller_ts_1.WalletController.getWallet));
/**
 * GET /api/wallets/:publicKey/export
 */
router.get("/:publicKey/export", (0, wallet_validation_ts_1.validate)(wallet_validation_ts_1.exportPrivateKeySchema), (0, asyncHandler_ts_1.asyncHandler)(wallet_controller_ts_1.WalletController.exportPrivateKey));
/**
 * POST /api/wallets/:publicKey/refresh-balance
 */
router.post("/:publicKey/refresh-balance", (0, wallet_validation_ts_1.validate)(wallet_validation_ts_1.getWalletSchema), (0, asyncHandler_ts_1.asyncHandler)(wallet_controller_ts_1.WalletController.refreshBalance));
/**
 * PATCH /api/wallets/:publicKey
 */
router.patch("/:publicKey", (0, wallet_validation_ts_1.validate)(wallet_validation_ts_1.getWalletSchema), (0, asyncHandler_ts_1.asyncHandler)(wallet_controller_ts_1.WalletController.updateWallet));
/**
 * DELETE /api/wallets/:publicKey
 */
router.delete("/:publicKey", (0, wallet_validation_ts_1.validate)(wallet_validation_ts_1.getWalletSchema), (0, asyncHandler_ts_1.asyncHandler)(wallet_controller_ts_1.WalletController.deactivateWallet));
exports.default = router;
