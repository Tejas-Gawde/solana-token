"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenController = void 0;
const token_service_ts_1 = require("./token.service.ts");
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
class TokenController {
    /**
     * POST /api/tokens/create
     */
    static async createToken(req, res) {
        const { creatorPublicKey, decimals, initialSupply, groupTag, freezeAuthority, } = req.body;
        const result = await token_service_ts_1.TokenService.createToken({
            creatorPublicKey,
            decimals,
            initialSupply,
            groupTag,
            freezeAuthority,
        });
        res
            .status(201)
            .json(ApiResponse_ts_1.ApiResponse.created("Token created successfully", result));
    }
    /**
     * POST /api/tokens/add-metadata
     */
    static async addMetadata(req, res) {
        const { mintAddress, creatorPublicKey, name, symbol, uri } = req.body;
        const result = await token_service_ts_1.TokenService.addMetadata({
            mintAddress,
            creatorPublicKey,
            name,
            symbol,
            uri,
        });
        res.status(200).json(ApiResponse_ts_1.ApiResponse.ok("Metadata added successfully", result));
    }
    /**
     * POST /api/tokens/create-with-metadata
     */
    static async createTokenWithMetadata(req, res) {
        const { creatorPublicKey, decimals, initialSupply, name, symbol, uri, groupTag, freezeAuthority, } = req.body;
        const result = await token_service_ts_1.TokenService.createTokenWithMetadata({
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
            .json(ApiResponse_ts_1.ApiResponse.created("Token created with metadata successfully", result));
    }
    /**
     * GET /api/tokens/:mintAddress
     */
    static async getToken(req, res) {
        const mintAddress = getStringParam(req.params.mintAddress, "mintAddress");
        const token = await token_service_ts_1.TokenService.getToken(mintAddress);
        res.status(200).json(ApiResponse_ts_1.ApiResponse.ok("Token retrieved successfully", token));
    }
    /**
     * GET /api/tokens
     */
    static async listTokens(req, res) {
        const groupTag = req.query.groupTag;
        const creatorWallet = req.query.creatorWallet;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const result = await token_service_ts_1.TokenService.listTokens({
            groupTag,
            creatorWallet,
            page,
            limit,
        });
        res.status(200).json(ApiResponse_ts_1.ApiResponse.ok("Tokens retrieved successfully", result.tokens, {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: Math.ceil(result.total / result.limit),
            ...(groupTag && { groupTag }),
            ...(creatorWallet && { creatorWallet }),
        }));
    }
    /**
     * GET /api/tokens/:mintAddress/on-chain
     */
    static async getOnChainInfo(req, res) {
        const mintAddress = getStringParam(req.params.mintAddress, "mintAddress");
        const info = await token_service_ts_1.TokenService.getOnChainMintInfo(mintAddress);
        res
            .status(200)
            .json(ApiResponse_ts_1.ApiResponse.ok("On-chain mint info retrieved successfully", info));
    }
    /**
     * GET /api/tokens/:mintAddress/metadata
     */
    static async getOnChainMetadata(req, res) {
        const mintAddress = getStringParam(req.params.mintAddress, "mintAddress");
        const metadata = await token_service_ts_1.TokenService.getOnChainMetadata(mintAddress);
        res
            .status(200)
            .json(ApiResponse_ts_1.ApiResponse.ok("On-chain metadata retrieved successfully", metadata));
    }
}
exports.TokenController = TokenController;
