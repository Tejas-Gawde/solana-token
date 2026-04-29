"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PumpLaunchController = void 0;
const pump_launch_service_ts_1 = require("./pump-launch.service.ts");
const ApiResponse_ts_1 = require("../../utils/ApiResponse.ts");
class PumpLaunchController {
    static async launch(req, res) {
        const { creatorPublicKey, userPublicKey, name, symbol, uri, mayhemMode, cashback, } = req.body;
        const result = await pump_launch_service_ts_1.PumpLaunchService.launchToken({
            creatorPublicKey,
            userPublicKey,
            name,
            symbol,
            uri,
            mayhemMode,
            cashback,
        });
        res.status(201).json(ApiResponse_ts_1.ApiResponse.created("Pump token launched", result));
    }
    static async launchWithBuy(req, res) {
        const { creatorPublicKey, userPublicKey, name, symbol, uri, mayhemMode, cashback, initialBuySol, slippage, } = req.body;
        const result = await pump_launch_service_ts_1.PumpLaunchService.launchToken({
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
            .json(ApiResponse_ts_1.ApiResponse.created("Pump token launched with initial buy", result));
    }
    static async launchWithMintPrivateKey(req, res) {
        const { creatorPublicKey, userPublicKey, name, symbol, uri, mintPrivateKey, mayhemMode, cashback, initialBuySol, slippage, } = req.body;
        const result = await pump_launch_service_ts_1.PumpLaunchService.launchToken({
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
            .json(ApiResponse_ts_1.ApiResponse.created("Pump token launched using provided mint private key", result));
    }
    static async buy(req, res) {
        const { mintAddress, userPublicKey, buySolAmount, buyTokenAmountRaw, slippage, } = req.body;
        const result = await pump_launch_service_ts_1.PumpLaunchService.buyFromBondingCurve({
            mintAddress,
            userPublicKey,
            buySolAmount,
            buyTokenAmountRaw,
            slippage,
        });
        res.status(200).json(ApiResponse_ts_1.ApiResponse.ok("Bought from bonding curve", result));
    }
    static async migrate(req, res) {
        const { mintAddress, userPublicKey } = req.body;
        const result = await pump_launch_service_ts_1.PumpLaunchService.migrateBondingCurve({
            mintAddress,
            userPublicKey,
        });
        res
            .status(200)
            .json(ApiResponse_ts_1.ApiResponse.ok("Bonding curve migration submitted", result));
    }
    static async getBondingCurve(req, res) {
        const { mintAddress } = req.params;
        const result = await pump_launch_service_ts_1.PumpLaunchService.getBondingCurveInfo(mintAddress);
        res
            .status(200)
            .json(ApiResponse_ts_1.ApiResponse.ok("Bonding curve state retrieved", result));
    }
}
exports.PumpLaunchController = PumpLaunchController;
