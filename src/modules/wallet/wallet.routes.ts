import { Router } from "express";
import { WalletController } from "./wallet.controller.ts";
import { asyncHandler } from "../../middleware/asyncHandler.ts";
import {
  validate,
  generateWalletSchema,
  batchGenerateSchema,
  importWalletSchema,
  fundWalletSchema,
  exportPrivateKeySchema,
  getWalletSchema,
  listWalletsSchema,
  batchExportSchema,
} from "./wallet.validation.ts";

const router = Router();

// ==================== WALLET ROUTES ====================

/**
 * POST /api/wallets/generate
 */
router.post(
  "/generate",
  validate(generateWalletSchema),
  asyncHandler(WalletController.generate),
);

/**
 * POST /api/wallets/batch-generate
 */
router.post(
  "/batch-generate",
  validate(batchGenerateSchema),
  asyncHandler(WalletController.batchGenerate),
);

/**
 * POST /api/wallets/import
 */
router.post(
  "/import",
  validate(importWalletSchema),
  asyncHandler(WalletController.importWallet),
);

/**
 * POST /api/wallets/fund
 */
router.post(
  "/fund",
  validate(fundWalletSchema),
  asyncHandler(WalletController.fundWallet),
);

/**
 * GET /api/wallets/batch-export/:groupTag
 * ⚠️ Must be BEFORE /:publicKey to avoid route conflict
 */
router.get(
  "/batch-export/:groupTag",
  validate(batchExportSchema),
  asyncHandler(WalletController.batchExport),
);

/**
 * GET /api/wallets
 */
router.get(
  "/",
  validate(listWalletsSchema),
  asyncHandler(WalletController.listWallets),
);

/**
 * GET /api/wallets/:publicKey
 */
router.get(
  "/:publicKey",
  validate(getWalletSchema),
  asyncHandler(WalletController.getWallet),
);

/**
 * GET /api/wallets/:publicKey/export
 */
router.get(
  "/:publicKey/export",
  validate(exportPrivateKeySchema),
  asyncHandler(WalletController.exportPrivateKey),
);

/**
 * POST /api/wallets/:publicKey/refresh-balance
 */
router.post(
  "/:publicKey/refresh-balance",
  validate(getWalletSchema),
  asyncHandler(WalletController.refreshBalance),
);

/**
 * PATCH /api/wallets/:publicKey
 */
router.patch(
  "/:publicKey",
  validate(getWalletSchema),
  asyncHandler(WalletController.updateWallet),
);

/**
 * DELETE /api/wallets/:publicKey
 */
router.delete(
  "/:publicKey",
  validate(getWalletSchema),
  asyncHandler(WalletController.deactivateWallet),
);

export default router;
