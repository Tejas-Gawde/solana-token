"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sharp_1 = __importDefault(require("sharp"));
const uuid_1 = require("uuid");
const index_ts_1 = require("../../config/index.ts");
const logger_ts_1 = require("../../utils/logger.ts");
const errorHandler_ts_1 = require("../../middleware/errorHandler.ts");
const metadata_model_ts_1 = require("./metadata.model.ts");
// Ensure public directories exist
function ensureDirectories() {
    const dirs = [
        index_ts_1.config.paths.public,
        index_ts_1.config.paths.images,
        index_ts_1.config.paths.metadataJson,
    ];
    for (const dir of dirs) {
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
    }
}
ensureDirectories();
function toPublicInfo(record) {
    return {
        id: record.id,
        metadataId: record.metadata_id,
        name: record.name,
        symbol: record.symbol,
        description: record.description,
        imageUrl: record.image_url,
        metadataUrl: record.metadata_url,
        showName: record.show_name === 1,
        createdOn: record.created_on,
        twitter: record.twitter,
        telegram: record.telegram,
        website: record.website,
        groupTag: record.group_tag,
        createdAt: record.created_at,
    };
}
function buildMetadataJson(record) {
    const json = {
        name: record.name,
        symbol: record.symbol,
        description: record.description,
        image: record.image_url,
        showName: record.show_name === 1,
        createdOn: record.created_on,
    };
    if (record.twitter)
        json.twitter = record.twitter;
    if (record.telegram)
        json.telegram = record.telegram;
    if (record.website)
        json.website = record.website;
    return json;
}
class MetadataService {
    /**
     * Create metadata from an uploaded image file (multipart form)
     */
    static async createFromUpload(options) {
        try {
            const metadataId = (0, uuid_1.v4)();
            const imageFilename = `${metadataId}.webp`;
            // Convert image to webp using sharp
            const imagePath = path_1.default.join(index_ts_1.config.paths.images, imageFilename);
            await (0, sharp_1.default)(options.imageBuffer)
                .webp({ quality: 85 })
                .resize(512, 512, {
                fit: "cover",
                withoutEnlargement: false,
            })
                .toFile(imagePath);
            logger_ts_1.logger.info(`Image saved: ${imagePath}`);
            // Build URLs
            const imageUrl = `${index_ts_1.config.server.baseUrl}/images/${imageFilename}`;
            const metadataUrl = `${index_ts_1.config.server.baseUrl}/metadata-json/${metadataId}.json`;
            // Save record to DB
            const record = metadata_model_ts_1.MetadataModel.create({
                metadataId,
                name: options.name,
                symbol: options.symbol,
                description: options.description,
                imageFilename,
                imageUrl,
                metadataUrl,
                showName: options.showName,
                createdOn: options.createdOn,
                twitter: options.twitter,
                telegram: options.telegram,
                website: options.website,
                groupTag: options.groupTag,
            });
            // Build and write metadata JSON
            const metadataJson = buildMetadataJson(record);
            const jsonPath = path_1.default.join(index_ts_1.config.paths.metadataJson, `${metadataId}.json`);
            fs_1.default.writeFileSync(jsonPath, JSON.stringify(metadataJson, null, 2));
            logger_ts_1.logger.info(`Metadata JSON saved: ${jsonPath}`);
            return {
                metadata: toPublicInfo(record),
                imageUrl,
                metadataUrl,
                metadataJson,
            };
        }
        catch (error) {
            if (error instanceof errorHandler_ts_1.AppError)
                throw error;
            logger_ts_1.logger.error(`Failed to create metadata from upload: ${error.message}`);
            throw new errorHandler_ts_1.AppError(`Failed to create metadata: ${error.message}`, 500);
        }
    }
    /**
     * Create metadata from an image URL (downloads and converts to webp)
     */
    static async createFromUrl(options) {
        try {
            const metadataId = (0, uuid_1.v4)();
            const imageFilename = `${metadataId}.webp`;
            // Download the image
            logger_ts_1.logger.info(`Downloading image from: ${options.imageUrl}`);
            const response = await fetch(options.imageUrl);
            if (!response.ok) {
                throw new errorHandler_ts_1.AppError(`Failed to download image: ${response.status} ${response.statusText}`, 400);
            }
            const arrayBuffer = await response.arrayBuffer();
            const imageBuffer = Buffer.from(arrayBuffer);
            if (imageBuffer.length === 0) {
                throw new errorHandler_ts_1.AppError("Downloaded image is empty", 400);
            }
            // Convert to webp using sharp
            const imagePath = path_1.default.join(index_ts_1.config.paths.images, imageFilename);
            await (0, sharp_1.default)(imageBuffer)
                .webp({ quality: 85 })
                .resize(512, 512, {
                fit: "cover",
                withoutEnlargement: false,
            })
                .toFile(imagePath);
            logger_ts_1.logger.info(`Image saved: ${imagePath}`);
            // Build URLs
            const hostedImageUrl = `${index_ts_1.config.server.baseUrl}/images/${imageFilename}`;
            const metadataUrl = `${index_ts_1.config.server.baseUrl}/metadata-json/${metadataId}.json`;
            // Save record to DB
            const record = metadata_model_ts_1.MetadataModel.create({
                metadataId,
                name: options.name,
                symbol: options.symbol,
                description: options.description,
                imageFilename,
                imageUrl: hostedImageUrl,
                metadataUrl,
                showName: options.showName,
                createdOn: options.createdOn,
                twitter: options.twitter,
                telegram: options.telegram,
                website: options.website,
                groupTag: options.groupTag,
            });
            // Build and write metadata JSON
            const metadataJson = buildMetadataJson(record);
            const jsonPath = path_1.default.join(index_ts_1.config.paths.metadataJson, `${metadataId}.json`);
            fs_1.default.writeFileSync(jsonPath, JSON.stringify(metadataJson, null, 2));
            logger_ts_1.logger.info(`Metadata JSON saved: ${jsonPath}`);
            return {
                metadata: toPublicInfo(record),
                imageUrl: hostedImageUrl,
                metadataUrl,
                metadataJson,
            };
        }
        catch (error) {
            if (error instanceof errorHandler_ts_1.AppError)
                throw error;
            logger_ts_1.logger.error(`Failed to create metadata from URL: ${error.message}`);
            throw new errorHandler_ts_1.AppError(`Failed to create metadata: ${error.message}`, 500);
        }
    }
    /**
     * Get metadata by ID
     */
    static async getMetadata(metadataId) {
        const record = metadata_model_ts_1.MetadataModel.findByMetadataId(metadataId);
        if (!record) {
            throw new errorHandler_ts_1.AppError(`Metadata not found: ${metadataId}`, 404);
        }
        return toPublicInfo(record);
    }
    /**
     * Get the raw metadata JSON by ID
     */
    static async getMetadataJson(metadataId) {
        const record = metadata_model_ts_1.MetadataModel.findByMetadataId(metadataId);
        if (!record) {
            throw new errorHandler_ts_1.AppError(`Metadata not found: ${metadataId}`, 404);
        }
        return buildMetadataJson(record);
    }
    /**
     * List all metadata records
     */
    static async listMetadata(options) {
        const { records, total } = metadata_model_ts_1.MetadataModel.list(options);
        return {
            records: records.map(toPublicInfo),
            total,
            page: options.page,
            limit: options.limit,
        };
    }
    /**
     * Delete metadata and its associated files
     */
    static async deleteMetadata(metadataId) {
        const record = metadata_model_ts_1.MetadataModel.findByMetadataId(metadataId);
        if (!record) {
            throw new errorHandler_ts_1.AppError(`Metadata not found: ${metadataId}`, 404);
        }
        // Delete image file
        const imagePath = path_1.default.join(index_ts_1.config.paths.images, record.image_filename);
        if (fs_1.default.existsSync(imagePath)) {
            fs_1.default.unlinkSync(imagePath);
            logger_ts_1.logger.info(`Deleted image: ${imagePath}`);
        }
        // Delete JSON file
        const jsonPath = path_1.default.join(index_ts_1.config.paths.metadataJson, `${metadataId}.json`);
        if (fs_1.default.existsSync(jsonPath)) {
            fs_1.default.unlinkSync(jsonPath);
            logger_ts_1.logger.info(`Deleted metadata JSON: ${jsonPath}`);
        }
        // Delete DB record
        metadata_model_ts_1.MetadataModel.delete(metadataId);
        logger_ts_1.logger.info(`Metadata deleted: ${metadataId}`);
    }
}
exports.MetadataService = MetadataService;
