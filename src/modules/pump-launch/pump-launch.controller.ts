import type { Request, Response } from "express";
import { PumpLaunchService } from "./pump-launch.service.ts";
import { ApiResponse } from "../../utils/ApiResponse.ts";

export class PumpLaunchController {
  static async createLaunch(req: Request, res: Response): Promise<void> {
    const payload = req.body;
    const launch = await PumpLaunchService.createLaunch(payload);

    res
      .status(201)
      .json(ApiResponse.created("Pump launch created successfully", launch));
  }

  static async executeLaunch(req: Request, res: Response): Promise<void> {
    const { mintAddress } = req.params as { mintAddress: string };

    const launch = await PumpLaunchService.executeLaunch(mintAddress);

    res
      .status(200)
      .json(ApiResponse.ok("Pump launch executed on chain", launch));
  }

  static async getLaunch(req: Request, res: Response): Promise<void> {
    const { mintAddress } = req.params as { mintAddress: string };
    const launch = await PumpLaunchService.getLaunch(mintAddress);

    res.status(200).json(ApiResponse.ok("Pump launch retrieved", launch));
  }

  static async listLaunches(req: Request, res: Response): Promise<void> {
    const query = req.query;
    const result = await PumpLaunchService.listLaunches({
      creatorWallet: query.creatorWallet as string | undefined,
      status: query.status as string | undefined,
      groupTag: query.groupTag as string | undefined,
      page: Number(query.page || 1),
      limit: Number(query.limit || 20),
    });

    res.status(200).json(
      ApiResponse.ok("Pump launches listed", result.launches, {
        total: result.total,
        page: result.page,
        limit: result.limit,
      }),
    );
  }

  static async updateLaunch(req: Request, res: Response): Promise<void> {
    const { mintAddress } = req.params as { mintAddress: string };

    const updated = await PumpLaunchService.updateLaunch(mintAddress, req.body);

    res.status(200).json(ApiResponse.ok("Pump launch updated", updated));
  }
}
