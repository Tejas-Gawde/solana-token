"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletController = void 0;
const wallet_service_ts_1 = require("./wallet.service.ts");
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
class WalletController {
    /**
     * POST /api/wallets/generate
     */
    static async generate(req, res) {
        const { groupTag } = req.body;
        const wallet = await wallet_service_ts_1.WalletService.generateWallet({ groupTag });
        res
            .status(201)
            .json(ApiResponse_ts_1.ApiResponse.created("Wallet generated successfully", wallet));
    }
    /**
     * POST /api/wallets/batch-generate
     */
    static async batchGenerate(req, res) {
        const { count, groupTag } = req.body;
        const wallets = await wallet_service_ts_1.WalletService.batchGenerateWallets({
            count,
            groupTag,
        });
        res
            .status(201)
            .json(ApiResponse_ts_1.ApiResponse.created(`Successfully generated ${wallets.length} wallets`, wallets));
    }
    /**
     * POST /api/wallets/import
     */
    static async importWallet(req, res) {
        const { privateKeyBase58, groupTag } = req.body;
        const wallet = await wallet_service_ts_1.WalletService.importWallet({
            privateKeyBase58,
            groupTag,
        });
        res
            .status(201)
            .json(ApiResponse_ts_1.ApiResponse.created("Wallet imported successfully", wallet));
    }
    /**
     * GET /api/wallets/:publicKey/export
     */
    static async exportPrivateKey(req, res) {
        const publicKey = getStringParam(req.params.publicKey, "publicKey");
        const walletWithKey = await wallet_service_ts_1.WalletService.exportPrivateKey(publicKey);
        res
            .status(200)
            .json(ApiResponse_ts_1.ApiResponse.ok("Private key exported successfully. Store securely!", walletWithKey));
    }
    /**
     * GET /api/wallets/batch-export/:groupTag
     */
    static async batchExport(req, res) {
        const groupTag = getStringParam(req.params.groupTag, "groupTag");
        const result = await wallet_service_ts_1.WalletService.batchExportByGroup(groupTag);
        res
            .status(200)
            .json(ApiResponse_ts_1.ApiResponse.ok(`Exported ${result.count} wallets for group: ${groupTag}. Store securely!`, result));
    }
    /**
     * GET /api/wallets/:publicKey
     */
    static async getWallet(req, res) {
        const publicKey = getStringParam(req.params.publicKey, "publicKey");
        const wallet = await wallet_service_ts_1.WalletService.getWallet(publicKey);
        res
            .status(200)
            .json(ApiResponse_ts_1.ApiResponse.ok("Wallet retrieved successfully", wallet));
    }
    /**
     * GET /api/wallets
     * GET /api/wallets?groupTag=launch-001
     */
    static async listWallets(req, res) {
        const groupTag = req.query.groupTag;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const result = await wallet_service_ts_1.WalletService.listWallets({
            groupTag,
            page,
            limit,
        });
        res.status(200).json(ApiResponse_ts_1.ApiResponse.ok("Wallets retrieved successfully", result.wallets, {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: Math.ceil(result.total / result.limit),
            ...(groupTag && { groupTag }),
        }));
    }
    /**
     * POST /api/wallets/fund
     */
    static async fundWallet(req, res) {
        const { publicKey, amountSol } = req.body;
        const result = await wallet_service_ts_1.WalletService.fundWallet({ publicKey, amountSol });
        res.status(200).json(ApiResponse_ts_1.ApiResponse.ok("Wallet funded successfully", result));
    }
    /**
     * POST /api/wallets/:publicKey/refresh-balance
     */
    static async refreshBalance(req, res) {
        const publicKey = getStringParam(req.params.publicKey, "publicKey");
        const wallet = await wallet_service_ts_1.WalletService.refreshBalance(publicKey);
        res
            .status(200)
            .json(ApiResponse_ts_1.ApiResponse.ok("Balance refreshed successfully", wallet));
    }
    /**
     * PATCH /api/wallets/:publicKey
     */
    static async updateWallet(req, res) {
        const publicKey = getStringParam(req.params.publicKey, "publicKey");
        const { groupTag } = req.body;
        const wallet = await wallet_service_ts_1.WalletService.updateWallet(publicKey, { groupTag });
        res.status(200).json(ApiResponse_ts_1.ApiResponse.ok("Wallet updated successfully", wallet));
    }
    /**
     * DELETE /api/wallets/:publicKey
     */
    static async deactivateWallet(req, res) {
        const publicKey = getStringParam(req.params.publicKey, "publicKey");
        const wallet = await wallet_service_ts_1.WalletService.deactivateWallet(publicKey);
        res
            .status(200)
            .json(ApiResponse_ts_1.ApiResponse.ok("Wallet deactivated successfully", wallet));
    }
}
exports.WalletController = WalletController;
