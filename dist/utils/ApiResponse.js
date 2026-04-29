"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponse = void 0;
class ApiResponse {
    constructor(success, message, data = null, meta) {
        this.success = success;
        this.message = message;
        this.data = data;
        if (meta)
            this.meta = meta;
    }
    static ok(message, data, meta) {
        return new ApiResponse(true, message, data, meta);
    }
    static created(message, data) {
        return new ApiResponse(true, message, data);
    }
    static error(message, error) {
        const response = new ApiResponse(false, message, null);
        if (error)
            response.error = error;
        return response;
    }
}
exports.ApiResponse = ApiResponse;
