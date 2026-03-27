import { Router } from "express";
import { TokenController } from "./token.controller.ts";
import { asyncHandler } from "../../middleware/asyncHandler.ts";
import { validate } from "../wallet/wallet.validation.ts";
import {
  createTokenSchema,
  addMetadataSchema,
  createTokenWithMetadataSchema,
  getTokenSchema,
  listTokensSchema,
} from "./token.validation.ts";

const router = Router();

/**
 * POST /api/tokens/create
 * Create a new SPL token (no metadata)
 */
router.post(
  "/create",
  validate(createTokenSchema),
  asyncHandler(TokenController.createToken),
);

/**
 * POST /api/tokens/add-metadata
 * Add metadata to an existing token
 */
router.post(
  "/add-metadata",
  validate(addMetadataSchema),
  asyncHandler(TokenController.addMetadata),
);

/**
 * POST /api/tokens/create-with-metadata
 * Create a token AND attach metadata in one call
 */
router.post(
  "/create-with-metadata",
  validate(createTokenWithMetadataSchema),
  asyncHandler(TokenController.createTokenWithMetadata),
);

/**
 * GET /api/tokens
 * List tokens
 */
router.get(
  "/",
  validate(listTokensSchema),
  asyncHandler(TokenController.listTokens),
);

/**
 * GET /api/tokens/:mintAddress
 * Get token from DB
 */
router.get(
  "/:mintAddress",
  validate(getTokenSchema),
  asyncHandler(TokenController.getToken),
);

/**
 * GET /api/tokens/:mintAddress/on-chain
 * Get live on-chain mint info
 */
router.get(
  "/:mintAddress/on-chain",
  validate(getTokenSchema),
  asyncHandler(TokenController.getOnChainInfo),
);

/**
 * GET /api/tokens/:mintAddress/metadata
 * Get live on-chain metadata
 */
router.get(
  "/:mintAddress/metadata",
  validate(getTokenSchema),
  asyncHandler(TokenController.getOnChainMetadata),
);

export default router;
