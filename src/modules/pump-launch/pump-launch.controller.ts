import type { Request, Response } from "express";
import { PumpLaunchService } from "./pump-launch.service.ts";
import { ApiResponse } from "../../utils/ApiResponse.ts";

export class PumpLaunchController {
  static async launch(req: Request, res: Response): Promise<void> {
    const {
      creatorPublicKey,
      userPublicKey,
      name,
      symbol,
      uri,
      mayhemMode,
      cashback,
    } = req.body;

    const result = await PumpLaunchService.launchToken({
      creatorPublicKey,
      userPublicKey,
      name,
      symbol,
      uri,
      mayhemMode,
      cashback,
    });

    res.status(201).json(ApiResponse.created("Pump token launched", result));
  }

  static async launchWithBuy(req: Request, res: Response): Promise<void> {
    const {
      creatorPublicKey,
      userPublicKey,
      name,
      symbol,
      uri,
      mayhemMode,
      cashback,
      initialBuySol,
      slippage,
    } = req.body;

    const result = await PumpLaunchService.launchToken({
      creatorPublicKey,
      userPublicKey,
      name,
      symbol,
      uri,
      mayhemMode,
      cashback,
      initialBuySol,
      slippage,
    });

    res
      .status(201)
      .json(
        ApiResponse.created("Pump token launched with initial buy", result),
      );
  }

  static async launchWithMintPrivateKey(
    req: Request,
    res: Response,
  ): Promise<void> {
    const {
      creatorPublicKey,
      userPublicKey,
      name,
      symbol,
      uri,
      mintPrivateKey,
      mayhemMode,
      cashback,
      initialBuySol,
      slippage,
    } = req.body;

    const result = await PumpLaunchService.launchToken({
      creatorPublicKey,
      userPublicKey,
      name,
      symbol,
      uri,
      mintPrivateKey,
      mayhemMode,
      cashback,
      initialBuySol,
      slippage,
    });

    res
      .status(201)
      .json(
        ApiResponse.created(
          "Pump token launched using provided mint private key",
          result,
        ),
      );
  }

  static async buy(req: Request, res: Response): Promise<void> {
    const {
      mintAddress,
      userPublicKey,
      buySolAmount,
      buyTokenAmountRaw,
      slippage,
    } = req.body;

    const result = await PumpLaunchService.buyFromBondingCurve({
      mintAddress,
      userPublicKey,
      buySolAmount,
      buyTokenAmountRaw,
      slippage,
    });

    res.status(200).json(ApiResponse.ok("Bought from bonding curve", result));
  }

  static async migrate(req: Request, res: Response): Promise<void> {
    const { mintAddress, userPublicKey } = req.body;

    const result = await PumpLaunchService.migrateBondingCurve({
      mintAddress,
      userPublicKey,
    });

    res
      .status(200)
      .json(ApiResponse.ok("Bonding curve migration submitted", result));
  }

  static async getBondingCurve(req: Request, res: Response): Promise<void> {
    const { mintAddress } = req.params as { mintAddress: string };

    const result = await PumpLaunchService.getBondingCurveInfo(mintAddress);

    res
      .status(200)
      .json(ApiResponse.ok("Bonding curve state retrieved", result));
  }
}
