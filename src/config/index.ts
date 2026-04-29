import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || "3000", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    isDev: process.env.NODE_ENV === "development",
    baseUrl:
      process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  },
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.testnet.solana.com",
    network: process.env.SOLANA_NETWORK || "devnet",
  },
  jito: {
    blockEngineUrl:
      process.env.JITO_BLOCK_ENGINE_URL || "https://testnet.block-engine.jito.wtf/api/v1/bundles",
    defaultTipSol: parseFloat(process.env.JITO_DEFAULT_TIP_SOL || "0.001"),
    statusTimeoutMs: parseInt(process.env.JITO_STATUS_TIMEOUT_MS || "60000", 10),
    statusPollIntervalMs: parseInt(
      process.env.JITO_STATUS_POLL_INTERVAL_MS || "3000",
      10,
    ),
    computeUnitPriceMicroLamports: parseInt(
      process.env.JITO_COMPUTE_UNIT_PRICE_MICRO_LAMPORTS || "100000",
      10,
    ),
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY || "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    iv: process.env.ENCRYPTION_IV || "f1e2d3c4b5a69788",
  },
  database: {
    path:
      process.env.DB_PATH ||
      path.join(process.cwd(), "data", "memecoin_launcher.db"),
  },
  paths: {
    public: path.join(process.cwd(), "public"),
    images: path.join(process.cwd(), "public", "images"),
    metadataJson: path.join(process.cwd(), "public", "metadata-json"),
  },
} as const;
