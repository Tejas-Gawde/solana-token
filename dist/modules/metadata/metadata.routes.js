"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const metadata_controller_ts_1 = require("./metadata.controller.ts");
const asyncHandler_ts_1 = require("../../middleware/asyncHandler.ts");
const wallet_validation_ts_1 = require("../wallet/wallet.validation.ts");
const metadata_validation_ts_1 = require("./metadata.validation.ts");
const router = (0, express_1.Router)();
// Multer config — store in memory, convert to webp later
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
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
        }
        else {
            cb(new Error(`Unsupported image format: ${file.mimetype}. Allowed: png, jpg, gif, webp, svg, bmp, tiff`));
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
router.post("/create-with-upload", upload.single("image"), (0, asyncHandler_ts_1.asyncHandler)(metadata_controller_ts_1.MetadataController.createWithUpload));
/**
 * POST /api/metadata/create-with-url
 * Create metadata with image URL (JSON body, image downloaded & converted)
 */
router.post("/create-with-url", (0, wallet_validation_ts_1.validate)(metadata_validation_ts_1.createMetadataWithUrlSchema), (0, asyncHandler_ts_1.asyncHandler)(metadata_controller_ts_1.MetadataController.createWithUrl));
/**
 * GET /api/metadata
 * List all metadata records
 */
router.get("/", (0, wallet_validation_ts_1.validate)(metadata_validation_ts_1.listMetadataSchema), (0, asyncHandler_ts_1.asyncHandler)(metadata_controller_ts_1.MetadataController.listMetadata));
/**
 * GET /api/metadata/:metadataId
 * Get metadata info from DB
 */
router.get("/:metadataId", (0, wallet_validation_ts_1.validate)(metadata_validation_ts_1.getMetadataSchema), (0, asyncHandler_ts_1.asyncHandler)(metadata_controller_ts_1.MetadataController.getMetadata));
/**
 * GET /api/metadata/:metadataId/json
 * Get raw metadata JSON
 */
router.get("/:metadataId/json", (0, wallet_validation_ts_1.validate)(metadata_validation_ts_1.getMetadataSchema), (0, asyncHandler_ts_1.asyncHandler)(metadata_controller_ts_1.MetadataController.getMetadataJson));
/**
 * DELETE /api/metadata/:metadataId
 * Delete metadata and files
 */
router.delete("/:metadataId", (0, wallet_validation_ts_1.validate)(metadata_validation_ts_1.getMetadataSchema), (0, asyncHandler_ts_1.asyncHandler)(metadata_controller_ts_1.MetadataController.deleteMetadata));
exports.default = router;
