"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const index_ts_1 = require("./index.ts");
const logger_ts_1 = require("../utils/logger.ts");
let db;
function getDatabase() {
    if (!db) {
        const dbDir = path_1.default.dirname(index_ts_1.config.database.path);
        if (!fs_1.default.existsSync(dbDir)) {
            fs_1.default.mkdirSync(dbDir, { recursive: true });
        }
        db = new better_sqlite3_1.default(index_ts_1.config.database.path, {
            verbose: index_ts_1.config.server.isDev
                ? (message) => logger_ts_1.logger.debug(`[SQL] ${message}`)
                : undefined,
        });
        db.pragma("journal_mode = WAL");
        db.pragma("foreign_keys = ON");
        initializeTables(db);
        logger_ts_1.logger.info(`Database connected at ${index_ts_1.config.database.path}`);
    }
    return db;
}
function initializeTables(db) {
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

    CREATE TABLE IF NOT EXISTS launch_bundles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      launch_bundle_id TEXT NOT NULL UNIQUE,
      distribution_id TEXT NOT NULL,
      creator_wallet TEXT NOT NULL,
      user_wallet TEXT NOT NULL,
      bundle_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      mint_address TEXT,
      lookup_table_address TEXT,
      create_lut_signature TEXT,
      extend_lut_signatures TEXT,
      launch_tx_signature TEXT,
      buyer_tx_signatures TEXT,
      tip_tx_signature TEXT,
      request_payload TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_launch_bundles_launch_id ON launch_bundles(launch_bundle_id);
    CREATE INDEX IF NOT EXISTS idx_launch_bundles_bundle_id ON launch_bundles(bundle_id);
    CREATE INDEX IF NOT EXISTS idx_launch_bundles_distribution ON launch_bundles(distribution_id);
    CREATE INDEX IF NOT EXISTS idx_launch_bundles_status ON launch_bundles(status);
  `);
    logger_ts_1.logger.info("Database tables initialized");
}
function closeDatabase() {
    if (db) {
        db.close();
        logger_ts_1.logger.info("Database connection closed");
    }
}
const isDirectRun = process.argv[1]?.endsWith("database.ts") ||
    process.argv[1]?.endsWith("database.ts");
if (isDirectRun) {
    getDatabase();
    logger_ts_1.logger.info("Database initialization complete");
    closeDatabase();
}
