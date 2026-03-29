import type { Request, Response } from "express";
import { MetadataService } from "./metadata.service.ts";
import { ApiResponse } from "../../utils/ApiResponse.ts";
import { AppError } from "../../middleware/errorHandler.ts";

function getStringParam(
  param: string | string[] | undefined,
  name: string,
): string {
  if (Array.isArray(param)) {
    throw new AppError(
      `Invalid parameter: ${name} must be a single value`,
      400,
    );
  }
  if (!param) {
    throw new AppError(`Missing required parameter: ${name}`, 400);
  }
  return param;
}

export class MetadataController {
  /**
   * POST /api/metadata/create-with-upload
   * Create metadata by uploading an image file (multipart/form-data)
   */
  static async createWithUpload(req: Request, res: Response): Promise<void> {
    const file = req.file;
    if (!file) {
      throw new AppError("Image file is required. Use field name 'image'", 400);
    }

    const {
      name,
      symbol,
      description = "",
      showName = "true",
      createdOn = "https://pump.fun",
      twitter,
      telegram,
      website,
      groupTag,
    } = req.body;

    if (!name || !symbol) {
      throw new AppError("name and symbol are required", 400);
    }

    const result = await MetadataService.createFromUpload({
      name,
      symbol,
      description,
      imageBuffer: file.buffer,
      originalFilename: file.originalname,
      showName: showName === "true" || showName === true,
      createdOn,
      twitter,
      telegram,
      website,
      groupTag,
    });

    res
      .status(201)
      .json(ApiResponse.created("Metadata created successfully", result));
  }

  /**
   * POST /api/metadata/create-with-url
   * Create metadata by providing an image URL (downloads and converts)
   */
  static async createWithUrl(req: Request, res: Response): Promise<void> {
    const {
      name,
      symbol,
      description = "",
      imageUrl,
      showName = true,
      createdOn = "https://pump.fun",
      twitter,
      telegram,
      website,
      groupTag,
    } = req.body;

    const result = await MetadataService.createFromUrl({
      name,
      symbol,
      description,
      imageUrl,
      showName,
      createdOn,
      twitter,
      telegram,
      website,
      groupTag,
    });

    res
      .status(201)
      .json(ApiResponse.created("Metadata created successfully", result));
  }

  /**
   * GET /api/metadata/:metadataId
   * Get metadata info
   */
  static async getMetadata(req: Request, res: Response): Promise<void> {
    const metadataId = getStringParam(req.params.metadataId, "metadataId");

    const metadata = await MetadataService.getMetadata(metadataId);

    res
      .status(200)
      .json(ApiResponse.ok("Metadata retrieved successfully", metadata));
  }

  /**
   * GET /api/metadata/:metadataId/json
   * Get raw metadata JSON (same format as the hosted file)
   */
  static async getMetadataJson(req: Request, res: Response): Promise<void> {
    const metadataId = getStringParam(req.params.metadataId, "metadataId");

    const json = await MetadataService.getMetadataJson(metadataId);

    res.status(200).json(json);
  }

  /**
   * GET /api/metadata
   * List all metadata
   */
  static async listMetadata(req: Request, res: Response): Promise<void> {
    const groupTag = req.query.groupTag as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await MetadataService.listMetadata({
      groupTag,
      page,
      limit,
    });

    res.status(200).json(
      ApiResponse.ok("Metadata list retrieved successfully", result.records, {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      }),
    );
  }

  /**
   * DELETE /api/metadata/:metadataId
   * Delete metadata and associated files
   */
  static async deleteMetadata(req: Request, res: Response): Promise<void> {
    const metadataId = getStringParam(req.params.metadataId, "metadataId");

    await MetadataService.deleteMetadata(metadataId);

    res
      .status(200)
      .json(ApiResponse.ok("Metadata deleted successfully", { metadataId }));
  }
}
