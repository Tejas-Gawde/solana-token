export class ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
  error?: string;
  meta?: Record<string, unknown>;

  constructor(
    success: boolean,
    message: string,
    data: T | null = null,
    meta?: Record<string, unknown>,
  ) {
    this.success = success;
    this.message = message;
    this.data = data;
    if (meta) this.meta = meta;
  }

  static ok<T>(
    message: string,
    data: T,
    meta?: Record<string, unknown>,
  ): ApiResponse<T> {
    return new ApiResponse(true, message, data, meta);
  }

  static created<T>(message: string, data: T): ApiResponse<T> {
    return new ApiResponse(true, message, data);
  }

  static error(message: string, error?: string): ApiResponse<null> {
    const response = new ApiResponse<null>(false, message, null);
    if (error) response.error = error;
    return response;
  }
}
