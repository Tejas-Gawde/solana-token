import express from "express";
import cors from "cors";
import helmet from "helmet";
import walletRoutes from "./modules/wallet/wallet.routes.ts";
import tokenRoutes from "./modules/token/token.routes.ts";
import pumpLaunchRoutes from "./modules/pump-launch/pump-launch.routes.ts";
import metadataRoutes from "./modules/metadata/metadata.routes.ts";
import distributeRoutes from "./modules/distribute/distribute.routes.ts";
import launchbundleRoutes from "./modules/launch-bundle/launch-bundle.routes.ts";
import { errorHandler } from "./middleware/errorHandler.ts";
import { ApiResponse } from "./utils/ApiResponse.ts";
import { logger } from "./utils/logger.ts";
import { config } from "./config/index.ts";
const app = express();

// ==================== GLOBAL MIDDLEWARE ====================
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ==================== STATIC FILE SERVING ====================
// Serve images at /images/:filename
app.use(
  "/images",
  express.static(config.paths.images, {
    maxAge: "7d",
    immutable: true,
    setHeaders: (res) => {
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    },
  }),
);

// Serve metadata JSON at /metadata-json/:filename
app.use(
  "/metadata-json",
  express.static(config.paths.metadataJson, {
    maxAge: "7d",
    immutable: true,
    setHeaders: (res) => {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    },
  }),
);

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ==================== ROUTES ====================

app.get("/api/health", (_req, res) => {
  res.json(
    ApiResponse.ok("Memecoin Launcher API is running", {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    }),
  );
});

app.use("/api/wallets", walletRoutes);
app.use("/api/tokens", tokenRoutes);
app.use("/api/pump", pumpLaunchRoutes);
app.use("/api/metadata", metadataRoutes);
app.use("/api/distribute", distributeRoutes);
app.use("/api/launch-bundle", launchbundleRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json(ApiResponse.error("Route not found"));
});

// Global error handler
app.use(errorHandler);

export default app;
