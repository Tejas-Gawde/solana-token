"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenModel = void 0;
const database_ts_1 = require("../../config/database.ts");
const logger_ts_1 = require("../../utils/logger.ts");
class TokenModel {
    /**
     * Insert a new token record
     */
    static create(data) {
        const db = (0, database_ts_1.getDatabase)();
        const stmt = db.prepare(`
      INSERT INTO tokens (
        mint_address, creator_wallet, decimals, initial_supply,
        initial_supply_raw, mint_authority, freeze_authority,
        group_tag, tx_signature, name, symbol, uri, metadata_tx_signature
      )
      VALUES (
        @mintAddress, @creatorWallet, @decimals, @initialSupply,
        @initialSupplyRaw, @mintAuthority, @freezeAuthority,
        @groupTag, @txSignature, @name, @symbol, @uri, @metadataTxSignature
      )
    `);
        const result = stmt.run({
            mintAddress: data.mintAddress,
            creatorWallet: data.creatorWallet,
            decimals: data.decimals,
            initialSupply: data.initialSupply,
            initialSupplyRaw: data.initialSupplyRaw,
            mintAuthority: data.mintAuthority,
            freezeAuthority: data.freezeAuthority,
            groupTag: data.groupTag || null,
            txSignature: data.txSignature,
            name: data.name || null,
            symbol: data.symbol || null,
            uri: data.uri || null,
            metadataTxSignature: data.metadataTxSignature || null,
        });
        logger_ts_1.logger.debug(`Token created with ID ${result.lastInsertRowid}: ${data.mintAddress}`);
        return this.findById(result.lastInsertRowid);
    }
    /**
     * Update metadata fields for a token
     */
    static updateMetadata(mintAddress, data) {
        const db = (0, database_ts_1.getDatabase)();
        const stmt = db.prepare(`
      UPDATE tokens
      SET name = @name,
          symbol = @symbol,
          uri = @uri,
          metadata_tx_signature = @metadataTxSignature
      WHERE mint_address = @mintAddress
    `);
        stmt.run({
            mintAddress,
            name: data.name,
            symbol: data.symbol,
            uri: data.uri,
            metadataTxSignature: data.metadataTxSignature,
        });
        return this.findByMintAddress(mintAddress);
    }
    /**
     * Find token by database ID
     */
    static findById(id) {
        const db = (0, database_ts_1.getDatabase)();
        const stmt = db.prepare("SELECT * FROM tokens WHERE id = ?");
        return stmt.get(id);
    }
    /**
     * Find token by mint address
     */
    static findByMintAddress(mintAddress) {
        const db = (0, database_ts_1.getDatabase)();
        const stmt = db.prepare("SELECT * FROM tokens WHERE mint_address = ?");
        return stmt.get(mintAddress);
    }
    /**
     * List tokens with filters and pagination
     */
    static list(options) {
        const db = (0, database_ts_1.getDatabase)();
        const conditions = [];
        const params = {};
        if (options.groupTag) {
            conditions.push("group_tag = @groupTag");
            params.groupTag = options.groupTag;
        }
        if (options.creatorWallet) {
            conditions.push("creator_wallet = @creatorWallet");
            params.creatorWallet = options.creatorWallet;
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const offset = (options.page - 1) * options.limit;
        const countStmt = db.prepare(`SELECT COUNT(*) as total FROM tokens ${whereClause}`);
        const { total } = countStmt.get(params);
        const listStmt = db.prepare(`SELECT * FROM tokens ${whereClause} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`);
        const tokens = listStmt.all({
            ...params,
            limit: options.limit,
            offset,
        });
        return { tokens, total };
    }
    /**
     * Find all tokens created by a specific wallet
     */
    static findByCreator(creatorWallet) {
        const db = (0, database_ts_1.getDatabase)();
        const stmt = db.prepare("SELECT * FROM tokens WHERE creator_wallet = ? ORDER BY created_at DESC");
        return stmt.all(creatorWallet);
    }
    /**
     * Find all tokens in a group
     */
    static findByGroupTag(groupTag) {
        const db = (0, database_ts_1.getDatabase)();
        const stmt = db.prepare("SELECT * FROM tokens WHERE group_tag = ? ORDER BY created_at DESC");
        return stmt.all(groupTag);
    }
}
exports.TokenModel = TokenModel;
