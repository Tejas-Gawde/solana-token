import { Router } from "express";
import multer from "multer";
import { MetadataController } from "./metadata.controller.ts";
import { asyncHandler } from "../../middleware/asyncHandler.ts";
import { validate } from "../wallet/wallet.validation.ts";
import {
  createMetadataWithUrlSchema,
  getMetadataSchema,
  listMetadataSchema,
} from "./metadata.validation.ts";

const router = Router();

// Multer config — store in memory, convert to webp later
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "image/bmp",
      "image/tiff",
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported image format: ${file.mimetype}. Allowed: png, jpg, gif, webp, svg, bmp, tiff`,
        ),
      );
    }
  },
});

/**
 * POST /api/metadata/create-with-upload
 * Create metadata with image file upload (multipart/form-data)
 *
 * Form fields:
 *   - image (file, required)
 *   - name (string, required)
 *   - symbol (string, required)
 *   - description (string, optional)
 *   - showName (string "true"/"false", optional, default "true")
 *   - createdOn (string, optional, default "https://pump.fun")
 *   - twitter (string, optional)
 *   - telegram (string, optional)
 *   - website (string, optional)
 *   - groupTag (string, optional)
 */
router.post(
  "/create-with-upload",
  upload.single("image"),
  asyncHandler(MetadataController.createWithUpload),
);

/**
 * POST /api/metadata/create-with-url
 * Create metadata with image URL (JSON body, image downloaded & converted)
 */
router.post(
  "/create-with-url",
  validate(createMetadataWithUrlSchema),
  asyncHandler(MetadataController.createWithUrl),
);

/**
 * GET /api/metadata
 * List all metadata records
 */
router.get(
  "/",
  validate(listMetadataSchema),
  asyncHandler(MetadataController.listMetadata),
);

/**
 * GET /api/metadata/:metadataId
 * Get metadata info from DB
 */
router.get(
  "/:metadataId",
  validate(getMetadataSchema),
  asyncHandler(MetadataController.getMetadata),
);

/**
 * GET /api/metadata/:metadataId/json
 * Get raw metadata JSON
 */
router.get(
  "/:metadataId/json",
  validate(getMetadataSchema),
  asyncHandler(MetadataController.getMetadataJson),
);

/**
 * DELETE /api/metadata/:metadataId
 * Delete metadata and files
 */
router.delete(
  "/:metadataId",
  validate(getMetadataSchema),
  asyncHandler(MetadataController.deleteMetadata),
);

export default router;
