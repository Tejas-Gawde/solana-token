"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletModel = void 0;
const database_ts_1 = require("../../config/database.ts");
const logger_ts_1 = require("../../utils/logger.ts");
class WalletModel {
    /**
     * Insert a new wallet into the database
     */
    static create(data) {
        const db = (0, database_ts_1.getDatabase)();
        const stmt = db.prepare(`
      INSERT INTO wallets (public_key, encrypted_private_key, group_tag)
      VALUES (@publicKey, @encryptedPrivateKey, @groupTag)
    `);
        const result = stmt.run({
            publicKey: data.publicKey,
            encryptedPrivateKey: data.encryptedPrivateKey,
            groupTag: data.groupTag || null,
        });
        logger_ts_1.logger.debug(`Wallet created with ID ${result.lastInsertRowid}: ${data.publicKey}`);
        return this.findById(result.lastInsertRowid);
    }
    /**
     * Insert multiple wallets in a single transaction
     */
    static createBatch(wallets) {
        const db = (0, database_ts_1.getDatabase)();
        const stmt = db.prepare(`
      INSERT INTO wallets (public_key, encrypted_private_key, group_tag)
      VALUES (@publicKey, @encryptedPrivateKey, @groupTag)
    `);
        const insertedIds = [];
        const insertMany = db.transaction((items) => {
            for (const item of items) {
                const result = stmt.run({
                    publicKey: item.publicKey,
                    encryptedPrivateKey: item.encryptedPrivateKey,
                    groupTag: item.groupTag || null,
                });
                insertedIds.push(result.lastInsertRowid);
            }
        });
        insertMany(wallets);
        logger_ts_1.logger.debug(`Batch created ${wallets.length} wallets`);
        return insertedIds.map((id) => this.findById(id));
    }
    /**
     * Find wallet by its database ID
     */
    static findById(id) {
        const db = (0, database_ts_1.getDatabase)();
        const stmt = db.prepare("SELECT * FROM wallets WHERE id = ?");
        return stmt.get(id);
    }
    /**
     * Find wallet by public key
     */
    static findByPublicKey(publicKey) {
        const db = (0, database_ts_1.getDatabase)();
        const stmt = db.prepare("SELECT * FROM wallets WHERE public_key = ?");
        return stmt.get(publicKey);
    }
    /**
     * Find all wallets by group tag (includes encrypted keys for batch export)
     */
    static findByGroupTag(groupTag) {
        const db = (0, database_ts_1.getDatabase)();
        const stmt = db.prepare("SELECT * FROM wallets WHERE group_tag = ? AND is_active = 1 ORDER BY created_at ASC");
        return stmt.all(groupTag);
    }
    /**
     * List wallets with filtering and pagination
     */
    static list(options) {
        const db = (0, database_ts_1.getDatabase)();
        const conditions = ["is_active = 1"];
        const params = {};
        if (options.groupTag) {
            conditions.push("group_tag = @groupTag");
            params.groupTag = options.groupTag;
        }
        const whereClause = `WHERE ${conditions.join(" AND ")}`;
        const offset = (options.page - 1) * options.limit;
        const countStmt = db.prepare(`SELECT COUNT(*) as total FROM wallets ${whereClause}`);
        const { total } = countStmt.get(params);
        const listStmt = db.prepare(`SELECT * FROM wallets ${whereClause} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`);
        const wallets = listStmt.all({
            ...params,
            limit: options.limit,
            offset,
        });
        return { wallets, total };
    }
    /**
     * Update wallet balance
     */
    static updateBalance(publicKey, balanceLamports) {
        const db = (0, database_ts_1.getDatabase)();
        const stmt = db.prepare(`
      UPDATE wallets 
      SET balance_lamports = @balanceLamports, 
          last_balance_check = datetime('now'),
          updated_at = datetime('now')
      WHERE public_key = @publicKey
    `);
        stmt.run({ publicKey, balanceLamports });
    }
    /**
     * Update wallet group tag
     */
    static update(publicKey, data) {
        const db = (0, database_ts_1.getDatabase)();
        const sets = ["updated_at = datetime('now')"];
        const params = { publicKey };
        if (data.groupTag !== undefined) {
            sets.push("group_tag = @groupTag");
            params.groupTag = data.groupTag;
        }
        if (data.isActive !== undefined) {
            sets.push("is_active = @isActive");
            params.isActive = data.isActive ? 1 : 0;
        }
        const stmt = db.prepare(`UPDATE wallets SET ${sets.join(", ")} WHERE public_key = @publicKey`);
        stmt.run(params);
        return this.findByPublicKey(publicKey);
    }
    /**
     * Soft-delete (deactivate) a wallet
     */
    static deactivate(publicKey) {
        const db = (0, database_ts_1.getDatabase)();
        const stmt = db.prepare(`UPDATE wallets SET is_active = 0, updated_at = datetime('now') WHERE public_key = ?`);
        const result = stmt.run(publicKey);
        return result.changes > 0;
    }
    /**
     * Hard delete a wallet
     */
    static delete(publicKey) {
        const db = (0, database_ts_1.getDatabase)();
        const stmt = db.prepare("DELETE FROM wallets WHERE public_key = ?");
        const result = stmt.run(publicKey);
        return result.changes > 0;
    }
    /**
     * Record a wallet transaction
     */
    static recordTransaction(data) {
        const db = (0, database_ts_1.getDatabase)();
        const stmt = db.prepare(`
      INSERT INTO wallet_transactions (wallet_id, signature, tx_type, amount_lamports, status)
      VALUES (@walletId, @signature, @txType, @amountLamports, @status)
    `);
        const result = stmt.run({
            walletId: data.walletId,
            signature: data.signature,
            txType: data.txType,
            amountLamports: data.amountLamports || 0,
            status: data.status || "confirmed",
        });
        const txStmt = db.prepare("SELECT * FROM wallet_transactions WHERE id = ?");
        return txStmt.get(result.lastInsertRowid);
    }
    /**
     * Get all public keys for a group tag
     */
    static getPublicKeysByGroup(groupTag) {
        const db = (0, database_ts_1.getDatabase)();
        const stmt = db.prepare("SELECT public_key FROM wallets WHERE group_tag = ? AND is_active = 1");
        const rows = stmt.all(groupTag);
        return rows.map((r) => r.public_key);
    }
    /**
     * Get all distinct group tags
     */
    static getGroupTags() {
        const db = (0, database_ts_1.getDatabase)();
        const stmt = db.prepare("SELECT DISTINCT group_tag FROM wallets WHERE group_tag IS NOT NULL ORDER BY group_tag ASC");
        const rows = stmt.all();
        return rows.map((r) => r.group_tag);
    }
}
exports.WalletModel = WalletModel;
