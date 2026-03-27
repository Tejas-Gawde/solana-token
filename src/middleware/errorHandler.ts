import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ApiResponse } from "../utils/ApiResponse.ts";
import { logger } from "../utils/logger.ts";

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error(`${req.method} ${req.path} - ${err.message}`, {
    stack: err.stack,
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));

    res
      .status(400)
      .json(
        ApiResponse.error("Validation failed", JSON.stringify(formattedErrors)),
      );
    return;
  }

  // Custom application errors
  if (err instanceof AppError) {
    res
      .status(err.statusCode)
      .json(
        ApiResponse.error(
          err.message,
          err.isOperational ? undefined : "Internal server error",
        ),
      );
    return;
  }

  // Unknown errors
  res
    .status(500)
    .json(
      ApiResponse.error(
        "Internal server error",
        process.env.NODE_ENV === "development" ? err.message : undefined,
      ),
    );
}
