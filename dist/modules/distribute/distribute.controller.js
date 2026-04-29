"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DistributeController = void 0;
const distribute_service_ts_1 = require("./distribute.service.ts");
const ApiResponse_ts_1 = require("../../utils/ApiResponse.ts");
const errorHandler_ts_1 = require("../../middleware/errorHandler.ts");
function getStringParam(param, name) {
    if (Array.isArray(param)) {
        throw new errorHandler_ts_1.AppError(`Invalid parameter: ${name} must be a single value`, 400);
    }
    if (!param) {
        throw new errorHandler_ts_1.AppError(`Missing required parameter: ${name}`, 400);
    }
    return param;
}
class DistributeController {
    /**
     * POST /api/distribute
     */
    static async distribute(req, res) {
        const { mainWalletPublicKey, numWallets, solPerWallet, groupTag } = req.body;
        const result = await distribute_service_ts_1.DistributeService.distribute({
            mainWalletPublicKey,
            numWallets,
            solPerWallet,
            groupTag,
        });
        res.status(201).json(ApiResponse_ts_1.ApiResponse.created(`Distribution complete — ${result.cWallets.length} wallets funded via obfuscated path`, result));
    }
    /**
     * GET /api/distribute/:distributionId
     */
    static async getDistribution(req, res) {
        const distributionId = getStringParam(req.params.distributionId, "distributionId");
        const distribution = await distribute_service_ts_1.DistributeService.getDistribution(distributionId);
        res.status(200).json(ApiResponse_ts_1.ApiResponse.ok("Distribution retrieved successfully", distribution));
    }
    /**
     * GET /api/distribute
     */
    static async listDistributions(req, res) {
        const groupTag = req.query.groupTag;
        const mainWallet = req.query.mainWallet;
        const status = req.query.status;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const result = await distribute_service_ts_1.DistributeService.listDistributions({
            groupTag,
            mainWallet,
            status,
            page,
            limit,
        });
        res.status(200).json(ApiResponse_ts_1.ApiResponse.ok("Distributions retrieved successfully", result.distributions, {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: Math.ceil(result.total / result.limit),
        }));
    }
    /**
     * GET /api/distribute/:distributionId/wallets
     */
    static async getDestinationWallets(req, res) {
        const distributionId = getStringParam(req.params.distributionId, "distributionId");
        const result = await distribute_service_ts_1.DistributeService.getDestinationWallets(distributionId);
        res.status(200).json(ApiResponse_ts_1.ApiResponse.ok(`${result.wallets.length} destination wallets for distribution`, result));
    }
}
exports.DistributeController = DistributeController;
