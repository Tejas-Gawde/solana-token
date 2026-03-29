import fs from "fs";
import path from "path";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { config } from "../../config/index.ts";
import { logger } from "../../utils/logger.ts";
import { AppError } from "../../middleware/errorHandler.ts";
import { MetadataModel } from "./metadata.model.ts";
import type {
  TokenMetadataPublicInfo,
  TokenMetadataRecord,
  TokenMetadataJson,
  CreateMetadataResult,
} from "./metadata.types.ts";

// Ensure public directories exist
function ensureDirectories(): void {
  const dirs = [
    config.paths.public,
    config.paths.images,
    config.paths.metadataJson,
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

ensureDirectories();

function toPublicInfo(record: TokenMetadataRecord): TokenMetadataPublicInfo {
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

function buildMetadataJson(record: TokenMetadataRecord): TokenMetadataJson {
  const json: TokenMetadataJson = {
    name: record.name,
    symbol: record.symbol,
    description: record.description,
    image: record.image_url,
    showName: record.show_name === 1,
    createdOn: record.created_on,
  };

  if (record.twitter) json.twitter = record.twitter;
  if (record.telegram) json.telegram = record.telegram;
  if (record.website) json.website = record.website;

  return json;
}

export class MetadataService {
  /**
   * Create metadata from an uploaded image file (multipart form)
   */
  static async createFromUpload(options: {
    name: string;
    symbol: string;
    description: string;
    imageBuffer: Buffer;
    originalFilename: string;
    showName: boolean;
    createdOn: string;
    twitter?: string;
    telegram?: string;
    website?: string;
    groupTag?: string;
  }): Promise<CreateMetadataResult> {
    try {
      const metadataId = uuidv4();
      const imageFilename = `${metadataId}.webp`;

      // Convert image to webp using sharp
      const imagePath = path.join(config.paths.images, imageFilename);

      await sharp(options.imageBuffer)
        .webp({ quality: 85 })
        .resize(512, 512, {
          fit: "cover",
          withoutEnlargement: false,
        })
        .toFile(imagePath);

      logger.info(`Image saved: ${imagePath}`);

      // Build URLs
      const imageUrl = `${config.server.baseUrl}/images/${imageFilename}`;
      const metadataUrl = `${config.server.baseUrl}/metadata-json/${metadataId}.json`;

      // Save record to DB
      const record = MetadataModel.create({
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
      const jsonPath = path.join(
        config.paths.metadataJson,
        `${metadataId}.json`,
      );
      fs.writeFileSync(jsonPath, JSON.stringify(metadataJson, null, 2));

      logger.info(`Metadata JSON saved: ${jsonPath}`);

      return {
        metadata: toPublicInfo(record),
        imageUrl,
        metadataUrl,
        metadataJson,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`Failed to create metadata from upload: ${error.message}`);
      throw new AppError(`Failed to create metadata: ${error.message}`, 500);
    }
  }

  /**
   * Create metadata from an image URL (downloads and converts to webp)
   */
  static async createFromUrl(options: {
    name: string;
    symbol: string;
    description: string;
    imageUrl: string;
    showName: boolean;
    createdOn: string;
    twitter?: string;
    telegram?: string;
    website?: string;
    groupTag?: string;
  }): Promise<CreateMetadataResult> {
    try {
      const metadataId = uuidv4();
      const imageFilename = `${metadataId}.webp`;

      // Download the image
      logger.info(`Downloading image from: ${options.imageUrl}`);
      const response = await fetch(options.imageUrl);

      if (!response.ok) {
        throw new AppError(
          `Failed to download image: ${response.status} ${response.statusText}`,
          400,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      if (imageBuffer.length === 0) {
        throw new AppError("Downloaded image is empty", 400);
      }

      // Convert to webp using sharp
      const imagePath = path.join(config.paths.images, imageFilename);

      await sharp(imageBuffer)
        .webp({ quality: 85 })
        .resize(512, 512, {
          fit: "cover",
          withoutEnlargement: false,
        })
        .toFile(imagePath);

      logger.info(`Image saved: ${imagePath}`);

      // Build URLs
      const hostedImageUrl = `${config.server.baseUrl}/images/${imageFilename}`;
      const metadataUrl = `${config.server.baseUrl}/metadata-json/${metadataId}.json`;

      // Save record to DB
      const record = MetadataModel.create({
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
      const jsonPath = path.join(
        config.paths.metadataJson,
        `${metadataId}.json`,
      );
      fs.writeFileSync(jsonPath, JSON.stringify(metadataJson, null, 2));

      logger.info(`Metadata JSON saved: ${jsonPath}`);

      return {
        metadata: toPublicInfo(record),
        imageUrl: hostedImageUrl,
        metadataUrl,
        metadataJson,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`Failed to create metadata from URL: ${error.message}`);
      throw new AppError(`Failed to create metadata: ${error.message}`, 500);
    }
  }

  /**
   * Get metadata by ID
   */
  static async getMetadata(
    metadataId: string,
  ): Promise<TokenMetadataPublicInfo> {
    const record = MetadataModel.findByMetadataId(metadataId);
    if (!record) {
      throw new AppError(`Metadata not found: ${metadataId}`, 404);
    }
    return toPublicInfo(record);
  }

  /**
   * Get the raw metadata JSON by ID
   */
  static async getMetadataJson(metadataId: string): Promise<TokenMetadataJson> {
    const record = MetadataModel.findByMetadataId(metadataId);
    if (!record) {
      throw new AppError(`Metadata not found: ${metadataId}`, 404);
    }
    return buildMetadataJson(record);
  }

  /**
   * List all metadata records
   */
  static async listMetadata(options: {
    groupTag?: string;
    page: number;
    limit: number;
  }): Promise<{
    records: TokenMetadataPublicInfo[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { records, total } = MetadataModel.list(options);

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
  static async deleteMetadata(metadataId: string): Promise<void> {
    const record = MetadataModel.findByMetadataId(metadataId);
    if (!record) {
      throw new AppError(`Metadata not found: ${metadataId}`, 404);
    }

    // Delete image file
    const imagePath = path.join(config.paths.images, record.image_filename);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      logger.info(`Deleted image: ${imagePath}`);
    }

    // Delete JSON file
    const jsonPath = path.join(config.paths.metadataJson, `${metadataId}.json`);
    if (fs.existsSync(jsonPath)) {
      fs.unlinkSync(jsonPath);
      logger.info(`Deleted metadata JSON: ${jsonPath}`);
    }

    // Delete DB record
    MetadataModel.delete(metadataId);

    logger.info(`Metadata deleted: ${metadataId}`);
  }
}
