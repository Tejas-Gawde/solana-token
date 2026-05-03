import type { Request, Response } from "express";
import { ApiResponse } from "../../utils/ApiResponse.ts";
import { LaunchBundleService } from "./launch-bundle.service.ts";

export class LaunchBundleController {
  static async launch(req: Request, res: Response): Promise<void> {
    const {
      creatorPublicKey,
      userPublicKey,
      distributionId,
      name,
      symbol,
      uri,
      mintPrivateKey,
      mayhemMode,
      cashback,
      buyers,
      jitoTipSol,
    } = req.body;

    const result = await LaunchBundleService.launch({
      creatorPublicKey,
      userPublicKey,
      distributionId,
      name,
      symbol,
      uri,
      mintPrivateKey,
      mayhemMode,
      cashback,
      buyers,
      jitoTipSol,
    });

    res.status(201).json(ApiResponse.created("Launch bundle submitted", result));
  }

  static async launchWithWallets(req: Request, res: Response): Promise<void> {
    const {
      creatorPublicKey,
      userPublicKey,
      name,
      symbol,
      uri,
      mintPrivateKey,
      mayhemMode,
      cashback,
      buyers,
      jitoTipSol,
    } = req.body;

    const result = await LaunchBundleService.launch({
      creatorPublicKey,
      userPublicKey,
      name,
      symbol,
      uri,
      mintPrivateKey,
      mayhemMode,
      cashback,
      buyers,
      jitoTipSol,
    });

    res
      .status(201)
      .json(ApiResponse.created("Launch bundle submitted (direct wallets)", result));
  }

  static async getLaunchBundle(req: Request, res: Response): Promise<void> {
    const { launchBundleId } = req.params as { launchBundleId: string };
    const result = await LaunchBundleService.getLaunchBundle(launchBundleId);
    res.status(200).json(ApiResponse.ok("Launch bundle retrieved", result));
  }
}
