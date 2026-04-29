"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const ApiResponse_ts_1 = require("../utils/ApiResponse.ts");
const logger_ts_1 = require("../utils/logger.ts");
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
function errorHandler(err, req, res, _next) {
    logger_ts_1.logger.error(`${req.method} ${req.path} - ${err.message}`, {
        stack: err.stack,
    });
    // Zod validation errors
    if (err instanceof zod_1.ZodError) {
        const formattedErrors = err.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
        }));
        res
            .status(400)
            .json(ApiResponse_ts_1.ApiResponse.error("Validation failed", JSON.stringify(formattedErrors)));
        return;
    }
    // Custom application errors
    if (err instanceof AppError) {
        res
            .status(err.statusCode)
            .json(ApiResponse_ts_1.ApiResponse.error(err.message, err.isOperational ? undefined : "Internal server error"));
        return;
    }
    // Unknown errors
    res
        .status(500)
        .json(ApiResponse_ts_1.ApiResponse.error("Internal server error", process.env.NODE_ENV === "development" ? err.message : undefined));
}
