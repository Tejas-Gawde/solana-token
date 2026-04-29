"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const wallet_routes_ts_1 = __importDefault(require("./modules/wallet/wallet.routes.ts"));
const token_routes_ts_1 = __importDefault(require("./modules/token/token.routes.ts"));
const pump_launch_routes_ts_1 = __importDefault(require("./modules/pump-launch/pump-launch.routes.ts"));
const metadata_routes_ts_1 = __importDefault(require("./modules/metadata/metadata.routes.ts"));
const distribute_routes_ts_1 = __importDefault(require("./modules/distribute/distribute.routes.ts"));
const launch_bundle_routes_ts_1 = __importDefault(require("./modules/launch-bundle/launch-bundle.routes.ts"));
const errorHandler_ts_1 = require("./middleware/errorHandler.ts");
const ApiResponse_ts_1 = require("./utils/ApiResponse.ts");
const logger_ts_1 = require("./utils/logger.ts");
const index_ts_1 = require("./config/index.ts");
const app = (0, express_1.default)();
// ==================== GLOBAL MIDDLEWARE ====================
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
// ==================== STATIC FILE SERVING ====================
// Serve images at /images/:filename
app.use("/images", express_1.default.static(index_ts_1.config.paths.images, {
    maxAge: "7d",
    immutable: true,
    setHeaders: (res) => {
        res.setHeader("Content-Type", "image/webp");
        res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    },
}));
// Serve metadata JSON at /metadata-json/:filename
app.use("/metadata-json", express_1.default.static(index_ts_1.config.paths.metadataJson, {
    maxAge: "7d",
    immutable: true,
    setHeaders: (res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    },
}));
// Request logging
app.use((req, _res, next) => {
    logger_ts_1.logger.info(`${req.method} ${req.path}`);
    next();
});
// ==================== ROUTES ====================
app.get("/api/health", (_req, res) => {
    res.json(ApiResponse_ts_1.ApiResponse.ok("Memecoin Launcher API is running", {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
    }));
});
app.use("/api/wallets", wallet_routes_ts_1.default);
app.use("/api/tokens", token_routes_ts_1.default);
app.use("/api/pump", pump_launch_routes_ts_1.default);
app.use("/api/metadata", metadata_routes_ts_1.default);
app.use("/api/distribute", distribute_routes_ts_1.default);
app.use("/api/launch-bundle", launch_bundle_routes_ts_1.default);
// 404 handler
app.use((_req, res) => {
    res.status(404).json(ApiResponse_ts_1.ApiResponse.error("Route not found"));
});
// Global error handler
app.use(errorHandler_ts_1.errorHandler);
exports.default = app;
