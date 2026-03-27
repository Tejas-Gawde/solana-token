import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || "3000", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    isDev: process.env.NODE_ENV === "development",
  },
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    network: process.env.SOLANA_NETWORK || "devnet",
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
} as const;
