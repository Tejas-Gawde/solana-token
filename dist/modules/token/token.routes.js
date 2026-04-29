"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const token_controller_ts_1 = require("./token.controller.ts");
const asyncHandler_ts_1 = require("../../middleware/asyncHandler.ts");
const wallet_validation_ts_1 = require("../wallet/wallet.validation.ts");
const token_validation_ts_1 = require("./token.validation.ts");
const router = (0, express_1.Router)();
/**
 * POST /api/tokens/create
 * Create a new SPL token (no metadata)
 */
router.post("/create", (0, wallet_validation_ts_1.validate)(token_validation_ts_1.createTokenSchema), (0, asyncHandler_ts_1.asyncHandler)(token_controller_ts_1.TokenController.createToken));
/**
 * POST /api/tokens/add-metadata
 * Add metadata to an existing token
 */
router.post("/add-metadata", (0, wallet_validation_ts_1.validate)(token_validation_ts_1.addMetadataSchema), (0, asyncHandler_ts_1.asyncHandler)(token_controller_ts_1.TokenController.addMetadata));
/**
 * POST /api/tokens/create-with-metadata
 * Create a token AND attach metadata in one call
 */
router.post("/create-with-metadata", (0, wallet_validation_ts_1.validate)(token_validation_ts_1.createTokenWithMetadataSchema), (0, asyncHandler_ts_1.asyncHandler)(token_controller_ts_1.TokenController.createTokenWithMetadata));
/**
 * GET /api/tokens
 * List tokens
 */
router.get("/", (0, wallet_validation_ts_1.validate)(token_validation_ts_1.listTokensSchema), (0, asyncHandler_ts_1.asyncHandler)(token_controller_ts_1.TokenController.listTokens));
/**
 * GET /api/tokens/:mintAddress
 * Get token from DB
 */
router.get("/:mintAddress", (0, wallet_validation_ts_1.validate)(token_validation_ts_1.getTokenSchema), (0, asyncHandler_ts_1.asyncHandler)(token_controller_ts_1.TokenController.getToken));
/**
 * GET /api/tokens/:mintAddress/on-chain
 * Get live on-chain mint info
 */
router.get("/:mintAddress/on-chain", (0, wallet_validation_ts_1.validate)(token_validation_ts_1.getTokenSchema), (0, asyncHandler_ts_1.asyncHandler)(token_controller_ts_1.TokenController.getOnChainInfo));
/**
 * GET /api/tokens/:mintAddress/metadata
 * Get live on-chain metadata
 */
router.get("/:mintAddress/metadata", (0, wallet_validation_ts_1.validate)(token_validation_ts_1.getTokenSchema), (0, asyncHandler_ts_1.asyncHandler)(token_controller_ts_1.TokenController.getOnChainMetadata));
exports.default = router;
