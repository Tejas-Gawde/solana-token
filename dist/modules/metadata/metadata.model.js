"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataModel = void 0;
const database_ts_1 = require("../../config/database.ts");
const logger_ts_1 = require("../../utils/logger.ts");
class MetadataModel {
    static create(data) {
        const db = (0, database_ts_1.getDatabase)();
        const stmt = db.prepare(`
      INSERT INTO token_metadata (
        metadata_id, name, symbol, description, image_filename,
        image_url, metadata_url, show_name, created_on,
        twitter, telegram, website, group_tag
      )
      VALUES (
        @metadataId, @name, @symbol, @description, @imageFilename,
        @imageUrl, @metadataUrl, @showName, @createdOn,
        @twitter, @telegram, @website, @groupTag
      )
    `);
        const result = stmt.run({
            metadataId: data.metadataId,
            name: data.name,
            symbol: data.symbol,
            description: data.description,
            imageFilename: data.imageFilename,
            imageUrl: data.imageUrl,
            metadataUrl: data.metadataUrl,
            showName: data.showName ? 1 : 0,
            createdOn: data.createdOn,
            twitter: data.twitter || null,
            telegram: data.telegram || null,
            website: data.website || null,
            groupTag: data.groupTag || null,
        });
        logger_ts_1.logger.debug(`Metadata created: ${data.metadataId}`);
        return this.findById(result.lastInsertRowid);
    }
    static findById(id) {
        const db = (0, database_ts_1.getDatabase)();
        return db.prepare("SELECT * FROM token_metadata WHERE id = ?").get(id);
    }
    static findByMetadataId(metadataId) {
        const db = (0, database_ts_1.getDatabase)();
        return db
            .prepare("SELECT * FROM token_metadata WHERE metadata_id = ?")
            .get(metadataId);
    }
    static list(options) {
        const db = (0, database_ts_1.getDatabase)();
        const conditions = [];
        const params = {};
        if (options.groupTag) {
            conditions.push("group_tag = @groupTag");
            params.groupTag = options.groupTag;
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const offset = (options.page - 1) * options.limit;
        const { total } = db
            .prepare(`SELECT COUNT(*) as total FROM token_metadata ${whereClause}`)
            .get(params);
        const records = db
            .prepare(`SELECT * FROM token_metadata ${whereClause} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`)
            .all({
            ...params,
            limit: options.limit,
            offset,
        });
        return { records, total };
    }
    static delete(metadataId) {
        const db = (0, database_ts_1.getDatabase)();
        const result = db
            .prepare("DELETE FROM token_metadata WHERE metadata_id = ?")
            .run(metadataId);
        return result.changes > 0;
    }
}
exports.MetadataModel = MetadataModel;
