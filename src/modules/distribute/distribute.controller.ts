import type { Request, Response } from "express";
import { DistributeService } from "./distribute.service.ts";
import { ApiResponse } from "../../utils/ApiResponse.ts";
import { AppError } from "../../middleware/errorHandler.ts";

function getStringParam(
  param: string | string[] | undefined,
  name: string
): string {
  if (Array.isArray(param)) {
    throw new AppError(`Invalid parameter: ${name} must be a single value`, 400);
  }
  if (!param) {
    throw new AppError(`Missing required parameter: ${name}`, 400);
  }
  return param;
}

export class DistributeController {
  /**
   * POST /api/distribute
   */
  static async distribute(req: Request, res: Response): Promise<void> {
    const { mainWalletPublicKey, numWallets, solPerWallet, groupTag } = req.body;

    const result = await DistributeService.distribute({
      mainWalletPublicKey,
      numWallets,
      solPerWallet,
      groupTag,
    });

    res.status(201).json(
      ApiResponse.created(
        `Distribution complete — ${result.cWallets.length} wallets funded via obfuscated path`,
        result
      )
    );
  }

  /**
   * GET /api/distribute/:distributionId
   */
  static async getDistribution(req: Request, res: Response): Promise<void> {
    const distributionId = getStringParam(
      req.params.distributionId,
      "distributionId"
    );

    const distribution = await DistributeService.getDistribution(distributionId);

    res.status(200).json(
      ApiResponse.ok("Distribution retrieved successfully", distribution)
    );
  }

  /**
   * GET /api/distribute
   */
  static async listDistributions(req: Request, res: Response): Promise<void> {
    const groupTag = req.query.groupTag as string | undefined;
    const mainWallet = req.query.mainWallet as string | undefined;
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await DistributeService.listDistributions({
      groupTag,
      mainWallet,
      status,
      page,
      limit,
    });

    res.status(200).json(
      ApiResponse.ok(
        "Distributions retrieved successfully",
        result.distributions,
        {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit),
        }
      )
    );
  }

  /**
   * GET /api/distribute/:distributionId/wallets
   */
  static async getDestinationWallets(
    req: Request,
    res: Response
  ): Promise<void> {
    const distributionId = getStringParam(
      req.params.distributionId,
      "distributionId"
    );

    const result = await DistributeService.getDestinationWallets(distributionId);

    res.status(200).json(
      ApiResponse.ok(
        `${result.wallets.length} destination wallets for distribution`,
        result
      )
    );
  }
}