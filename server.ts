import app from "./src/app.ts";
import { config } from "./src/config/index.ts";
import { getDatabase, closeDatabase } from "./src/config/database.ts";
import { logger } from "./src/utils/logger.ts";

// Initialize database on startup
getDatabase();

const server = app.listen(config.server.port, () => {
  logger.info(`🚀 Memecoin Launcher API running on port ${config.server.port}`);
  logger.info(`📡 Network: ${config.solana.network}`);
  logger.info(`🔗 RPC: ${config.solana.rpcUrl}`);
  logger.info(`🌍 Environment: ${config.server.nodeEnv}`);
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  server.close(() => {
    closeDatabase();
    logger.info("Server shut down gracefully");
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error("Forced shutdown due to timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason: any) => {
  logger.error(`Unhandled Rejection: ${reason?.message || reason}`);
});

process.on("uncaughtException", (error: Error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  gracefulShutdown("uncaughtException");
});
