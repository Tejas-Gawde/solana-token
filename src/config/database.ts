import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { config } from "./index.ts";
import { logger } from "../utils/logger.ts";

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbDir = path.dirname(config.database.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(config.database.path, {
      verbose: config.server.isDev
        ? (message) => logger.debug(`[SQL] ${message}`)
        : undefined,
    });

    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    initializeTables(db);
    logger.info(`Database connected at ${config.database.path}`);
  }

  return db;
}

function initializeTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_key TEXT NOT NULL UNIQUE,
      encrypted_private_key TEXT NOT NULL,
      group_tag TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      balance_lamports INTEGER DEFAULT 0,
      last_balance_check TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_wallets_public_key ON wallets(public_key);
    CREATE INDEX IF NOT EXISTS idx_wallets_group_tag ON wallets(group_tag);
    CREATE INDEX IF NOT EXISTS idx_wallets_is_active ON wallets(is_active);

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_id INTEGER NOT NULL,
      signature TEXT NOT NULL UNIQUE,
      tx_type TEXT NOT NULL,
      amount_lamports INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet_id ON wallet_transactions(wallet_id);
    CREATE INDEX IF NOT EXISTS idx_wallet_tx_signature ON wallet_transactions(signature);

    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mint_address TEXT NOT NULL UNIQUE,
      creator_wallet TEXT NOT NULL,
      decimals INTEGER NOT NULL DEFAULT 9,
      initial_supply TEXT NOT NULL,
      initial_supply_raw TEXT NOT NULL,
      mint_authority TEXT NOT NULL,
      freeze_authority TEXT,
      group_tag TEXT,
      tx_signature TEXT NOT NULL,
      name TEXT,
      symbol TEXT,
      uri TEXT,
      metadata_tx_signature TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (creator_wallet) REFERENCES wallets(public_key)
    );

    CREATE INDEX IF NOT EXISTS idx_tokens_mint_address ON tokens(mint_address);
    CREATE INDEX IF NOT EXISTS idx_tokens_creator_wallet ON tokens(creator_wallet);
    CREATE INDEX IF NOT EXISTS idx_tokens_group_tag ON tokens(group_tag);
  `);

  logger.info("Database tables initialized");
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    logger.info("Database connection closed");
  }
}

const isDirectRun =
  process.argv[1]?.endsWith("database.ts") ||
  process.argv[1]?.endsWith("database.ts");
if (isDirectRun) {
  getDatabase();
  logger.info("Database initialization complete");
  closeDatabase();
}
