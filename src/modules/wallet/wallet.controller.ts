import type { Request, Response } from "express";
import { WalletService } from "./wallet.service.ts";
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

export class WalletController {
  /**
   * POST /api/wallets/generate
   */
  static async generate(req: Request, res: Response): Promise<void> {
    const { groupTag } = req.body;

    const wallet = await WalletService.generateWallet({ groupTag });

    res
      .status(201)
      .json(ApiResponse.created("Wallet generated successfully", wallet));
  }

  /**
   * POST /api/wallets/batch-generate
   */
  static async batchGenerate(req: Request, res: Response): Promise<void> {
    const { count, groupTag } = req.body;

    const wallets = await WalletService.batchGenerateWallets({
      count,
      groupTag,
    });

    res
      .status(201)
      .json(
        ApiResponse.created(
          `Successfully generated ${wallets.length} wallets`,
          wallets,
        ),
      );
  }

  /**
   * POST /api/wallets/import
   */
  static async importWallet(req: Request, res: Response): Promise<void> {
    const { privateKeyBase58, groupTag } = req.body;

    const wallet = await WalletService.importWallet({
      privateKeyBase58,
      groupTag,
    });

    res
      .status(201)
      .json(ApiResponse.created("Wallet imported successfully", wallet));
  }

  /**
   * GET /api/wallets/:publicKey/export
   */
  static async exportPrivateKey(req: Request, res: Response): Promise<void> {
    const publicKey = getStringParam(req.params.publicKey, "publicKey");

    const walletWithKey = await WalletService.exportPrivateKey(publicKey);

    res
      .status(200)
      .json(
        ApiResponse.ok(
          "Private key exported successfully. Store securely!",
          walletWithKey,
        ),
      );
  }

  /**
   * GET /api/wallets/batch-export/:groupTag
   */
  static async batchExport(req: Request, res: Response): Promise<void> {
    const groupTag = getStringParam(req.params.groupTag, "groupTag");

    const result = await WalletService.batchExportByGroup(groupTag);

    res
      .status(200)
      .json(
        ApiResponse.ok(
          `Exported ${result.count} wallets for group: ${groupTag}. Store securely!`,
          result,
        ),
      );
  }

  /**
   * GET /api/wallets/:publicKey
   */
  static async getWallet(req: Request, res: Response): Promise<void> {
    const publicKey = getStringParam(req.params.publicKey, "publicKey");

    const wallet = await WalletService.getWallet(publicKey);

    res
      .status(200)
      .json(ApiResponse.ok("Wallet retrieved successfully", wallet));
  }

  /**
   * GET /api/wallets
   * GET /api/wallets?groupTag=launch-001
   */
  static async listWallets(req: Request, res: Response): Promise<void> {
    const groupTag = req.query.groupTag as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await WalletService.listWallets({
      groupTag,
      page,
      limit,
    });

    res.status(200).json(
      ApiResponse.ok("Wallets retrieved successfully", result.wallets, {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
        ...(groupTag && { groupTag }),
      }),
    );
  }

  /**
   * POST /api/wallets/fund
   */
  static async fundWallet(req: Request, res: Response): Promise<void> {
    const { publicKey, amountSol } = req.body;

    const result = await WalletService.fundWallet({ publicKey, amountSol });

    res.status(200).json(ApiResponse.ok("Wallet funded successfully", result));
  }

  /**
   * POST /api/wallets/:publicKey/refresh-balance
   */
  static async refreshBalance(req: Request, res: Response): Promise<void> {
    const publicKey = getStringParam(req.params.publicKey, "publicKey");

    const wallet = await WalletService.refreshBalance(publicKey);

    res
      .status(200)
      .json(ApiResponse.ok("Balance refreshed successfully", wallet));
  }

  /**
   * PATCH /api/wallets/:publicKey
   */
  static async updateWallet(req: Request, res: Response): Promise<void> {
    const publicKey = getStringParam(req.params.publicKey, "publicKey");
    const { groupTag } = req.body;

    const wallet = await WalletService.updateWallet(publicKey, { groupTag });

    res.status(200).json(ApiResponse.ok("Wallet updated successfully", wallet));
  }

  /**
   * DELETE /api/wallets/:publicKey
   */
  static async deactivateWallet(req: Request, res: Response): Promise<void> {
    const publicKey = getStringParam(req.params.publicKey, "publicKey");

    const wallet = await WalletService.deactivateWallet(publicKey);

    res
      .status(200)
      .json(ApiResponse.ok("Wallet deactivated successfully", wallet));
  }
}
