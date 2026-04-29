"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaunchBundleController = void 0;
const ApiResponse_ts_1 = require("../../utils/ApiResponse.ts");
const launch_bundle_service_ts_1 = require("./launch-bundle.service.ts");
class LaunchBundleController {
    static async launch(req, res) {
        const { creatorPublicKey, userPublicKey, distributionId, name, symbol, uri, mintPrivateKey, mayhemMode, cashback, buyers, jitoTipSol, } = req.body;
        const result = await launch_bundle_service_ts_1.LaunchBundleService.launch({
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
        res.status(201).json(ApiResponse_ts_1.ApiResponse.created("Launch bundle submitted", result));
    }
    static async launchWithWallets(req, res) {
        const { creatorPublicKey, userPublicKey, name, symbol, uri, mintPrivateKey, mayhemMode, cashback, buyers, jitoTipSol, } = req.body;
        const result = await launch_bundle_service_ts_1.LaunchBundleService.launch({
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
            .json(ApiResponse_ts_1.ApiResponse.created("Launch bundle submitted (direct wallets)", result));
    }
    static async getLaunchBundle(req, res) {
        const { launchBundleId } = req.params;
        const result = await launch_bundle_service_ts_1.LaunchBundleService.getLaunchBundle(launchBundleId);
        res.status(200).json(ApiResponse_ts_1.ApiResponse.ok("Launch bundle retrieved", result));
    }
}
exports.LaunchBundleController = LaunchBundleController;
