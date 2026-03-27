import type { Request, Response } from "express";
import { TokenService } from "./token.service.ts";
import { ApiResponse } from "../../utils/ApiResponse.ts";
import { AppError } from "../../middleware/errorHandler.ts";

function getStringParam(
  param: string | string[] | undefined,
  name: string,
): string {
  if (Array.isArray(param)) {
    throw new AppError(
      `Invalid parameter: ${name} must be a single value`,
      400,
    );
  }
  if (!param) {
    throw new AppError(`Missing required parameter: ${name}`, 400);
  }
  return param;
}

export class TokenController {
  /**
   * POST /api/tokens/create
   */
  static async createToken(req: Request, res: Response): Promise<void> {
    const {
      creatorPublicKey,
      decimals,
      initialSupply,
      groupTag,
      freezeAuthority,
    } = req.body;

    const result = await TokenService.createToken({
      creatorPublicKey,
      decimals,
      initialSupply,
      groupTag,
      freezeAuthority,
    });

    res
      .status(201)
      .json(ApiResponse.created("Token created successfully", result));
  }

  /**
   * POST /api/tokens/add-metadata
   */
  static async addMetadata(req: Request, res: Response): Promise<void> {
    const { mintAddress, creatorPublicKey, name, symbol, uri } = req.body;

    const result = await TokenService.addMetadata({
      mintAddress,
      creatorPublicKey,
      name,
      symbol,
      uri,
    });

    res.status(200).json(ApiResponse.ok("Metadata added successfully", result));
  }

  /**
   * POST /api/tokens/create-with-metadata
   */
  static async createTokenWithMetadata(
    req: Request,
    res: Response,
  ): Promise<void> {
    const {
      creatorPublicKey,
      decimals,
      initialSupply,
      name,
      symbol,
      uri,
      groupTag,
      freezeAuthority,
    } = req.body;

    const result = await TokenService.createTokenWithMetadata({
      creatorPublicKey,
      decimals,
      initialSupply,
      name,
      symbol,
      uri,
      groupTag,
      freezeAuthority,
    });

    res
      .status(201)
      .json(
        ApiResponse.created("Token created with metadata successfully", result),
      );
  }

  /**
   * GET /api/tokens/:mintAddress
   */
  static async getToken(req: Request, res: Response): Promise<void> {
    const mintAddress = getStringParam(req.params.mintAddress, "mintAddress");

    const token = await TokenService.getToken(mintAddress);

    res.status(200).json(ApiResponse.ok("Token retrieved successfully", token));
  }

  /**
   * GET /api/tokens
   */
  static async listTokens(req: Request, res: Response): Promise<void> {
    const groupTag = req.query.groupTag as string | undefined;
    const creatorWallet = req.query.creatorWallet as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await TokenService.listTokens({
      groupTag,
      creatorWallet,
      page,
      limit,
    });

    res.status(200).json(
      ApiResponse.ok("Tokens retrieved successfully", result.tokens, {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
        ...(groupTag && { groupTag }),
        ...(creatorWallet && { creatorWallet }),
      }),
    );
  }

  /**
   * GET /api/tokens/:mintAddress/on-chain
   */
  static async getOnChainInfo(req: Request, res: Response): Promise<void> {
    const mintAddress = getStringParam(req.params.mintAddress, "mintAddress");

    const info = await TokenService.getOnChainMintInfo(mintAddress);

    res
      .status(200)
      .json(ApiResponse.ok("On-chain mint info retrieved successfully", info));
  }

  /**
   * GET /api/tokens/:mintAddress/metadata
   */
  static async getOnChainMetadata(req: Request, res: Response): Promise<void> {
    const mintAddress = getStringParam(req.params.mintAddress, "mintAddress");

    const metadata = await TokenService.getOnChainMetadata(mintAddress);

    res
      .status(200)
      .json(
        ApiResponse.ok("On-chain metadata retrieved successfully", metadata),
      );
  }
}
