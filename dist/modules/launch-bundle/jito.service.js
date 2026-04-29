"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JitoService = void 0;
const index_ts_1 = require("../../config/index.ts");
const errorHandler_ts_1 = require("../../middleware/errorHandler.ts");
class JitoService {
    static async rpcCall(method, params) {
        const response = await fetch(index_ts_1.config.jito.blockEngineUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: Date.now(),
                method,
                params,
            }),
        });
        if (!response.ok) {
            throw new errorHandler_ts_1.AppError(`Jito relay request failed with status ${response.status}`, 502);
        }
        const json = (await response.json());
        if (json.error) {
            throw new errorHandler_ts_1.AppError(`Jito relay error (${json.error.code}): ${json.error.message}`, 502);
        }
        if (!json.result) {
            throw new errorHandler_ts_1.AppError("Jito relay returned empty result", 502);
        }
        return json.result;
    }
    static serializeBundleTransactions(transactions) {
        return transactions.map((tx) => Buffer.from(tx.serialize()).toString("base64"));
    }
    static async getTipAccount() {
        const accounts = await this.rpcCall("getTipAccounts", []);
        if (!accounts.length) {
            throw new errorHandler_ts_1.AppError("No Jito tip accounts available", 502);
        }
        return accounts[0];
    }
    static async sendBundle(transactions) {
        const encoded = this.serializeBundleTransactions(transactions);
        const result = await this.rpcCall("sendBundle", [encoded]);
        if (typeof result === "string") {
            return result;
        }
        if (!result.bundle_id) {
            throw new errorHandler_ts_1.AppError("Jito bundle id missing in response", 502);
        }
        return result.bundle_id;
    }
    static async getInflightBundleStatus(bundleId) {
        const result = await this.rpcCall("getInflightBundleStatuses", [[bundleId]]);
        const status = result.value?.[0];
        if (!status)
            return { status: "Pending" };
        return {
            status: status.status,
            landed_slot: status.landed_slot,
            error: status.error,
        };
    }
    static async waitForBundleFinalStatus(bundleId) {
        const startedAt = Date.now();
        while (Date.now() - startedAt < index_ts_1.config.jito.statusTimeoutMs) {
            const status = await this.getInflightBundleStatus(bundleId);
            if (status.status === "Landed")
                return "landed";
            if (status.status === "Failed") {
                throw new errorHandler_ts_1.AppError(`Jito bundle failed: ${status.error || "unknown error"}`, 500);
            }
            await new Promise((resolve) => setTimeout(resolve, index_ts_1.config.jito.statusPollIntervalMs));
        }
        return "timeout";
    }
}
exports.JitoService = JitoService;
