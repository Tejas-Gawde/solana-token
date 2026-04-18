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

    CREATE TABLE IF NOT EXISTS pump_launches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mint_address TEXT NOT NULL UNIQUE,
      creator_wallet TEXT NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      metadata_uri TEXT,
      twitter TEXT,
      telegram TEXT,
      website TEXT,
      initial_buy_sol REAL,
      group_tag TEXT,
      create_tx_signature TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (creator_wallet) REFERENCES wallets(public_key)
    );

    CREATE INDEX IF NOT EXISTS idx_pump_launches_mint ON pump_launches(mint_address);
    CREATE INDEX IF NOT EXISTS idx_pump_launches_creator ON pump_launches(creator_wallet);
    CREATE INDEX IF NOT EXISTS idx_pump_launches_group ON pump_launches(group_tag);
    CREATE INDEX IF NOT EXISTS idx_pump_launches_status ON pump_launches(status);

    CREATE TABLE IF NOT EXISTS pump_buys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      launch_id INTEGER NOT NULL,
      mint_address TEXT NOT NULL,
      buyer_wallet TEXT NOT NULL,
      amount_sol REAL NOT NULL,
      tx_signature TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (launch_id) REFERENCES pump_launches(id) ON DELETE CASCADE,
      FOREIGN KEY (buyer_wallet) REFERENCES wallets(public_key)
    );

    CREATE INDEX IF NOT EXISTS idx_pump_buys_launch ON pump_buys(launch_id);
    CREATE INDEX IF NOT EXISTS idx_pump_buys_mint ON pump_buys(mint_address);
    CREATE INDEX IF NOT EXISTS idx_pump_buys_buyer ON pump_buys(buyer_wallet);

    CREATE TABLE IF NOT EXISTS token_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metadata_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image_filename TEXT NOT NULL,
      image_url TEXT NOT NULL,
      metadata_url TEXT NOT NULL,
      show_name INTEGER NOT NULL DEFAULT 1,
      created_on TEXT NOT NULL DEFAULT 'https://pump.fun',
      twitter TEXT,
      telegram TEXT,
      website TEXT,
      group_tag TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_token_metadata_id ON token_metadata(metadata_id);
    CREATE INDEX IF NOT EXISTS idx_token_metadata_group ON token_metadata(group_tag);

    CREATE TABLE IF NOT EXISTS distributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      distribution_id TEXT NOT NULL UNIQUE,
      main_wallet TEXT NOT NULL,
      num_wallets INTEGER NOT NULL,
      sol_per_wallet REAL NOT NULL,
      total_sol REAL NOT NULL,
      step1_tx_signature TEXT,
      step2_tx_signatures TEXT,
      b_wallets_group_tag TEXT NOT NULL,
      c_wallets_group_tag TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      group_tag TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

        CREATE TABLE IF NOT EXISTS wallets_temp_distribute (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_key TEXT NOT NULL UNIQUE,
      encrypted_private_key TEXT NOT NULL,
      distribution_id TEXT NOT NULL,
      wallet_index INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_temp_wallets_pk ON wallets_temp_distribute(public_key);
    CREATE INDEX IF NOT EXISTS idx_temp_wallets_dist ON wallets_temp_distribute(distribution_id);
    CREATE INDEX IF NOT EXISTS idx_distributions_id ON distributions(distribution_id);
    CREATE INDEX IF NOT EXISTS idx_distributions_main ON distributions(main_wallet);
    CREATE INDEX IF NOT EXISTS idx_distributions_group ON distributions(group_tag);
    CREATE INDEX IF NOT EXISTS idx_distributions_status ON distributions(status);
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
