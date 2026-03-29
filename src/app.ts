import express from "express";
import cors from "cors";
import helmet from "helmet";
import walletRoutes from "./modules/wallet/wallet.routes.ts";
import tokenRoutes from "./modules/token/token.routes.ts";
import pumpLaunchRoutes from "./modules/pump-launch/pump-launch.routes.ts";
import { errorHandler } from "./middleware/errorHandler.ts";
import { ApiResponse } from "./utils/ApiResponse.ts";
import { logger } from "./utils/logger.ts";

const app = express();

// ==================== GLOBAL MIDDLEWARE ====================
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

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
app.use("/api/pump-launches", pumpLaunchRoutes);

app.use((_req, res) => {
  res.status(404).json(ApiResponse.error("Route not found"));
});

app.use(errorHandler);

export default app;
