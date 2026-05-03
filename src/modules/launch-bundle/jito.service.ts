import type { VersionedTransaction } from "@solana/web3.js";
import { config } from "../../config/index.ts";
import { AppError } from "../../middleware/errorHandler.ts";

interface JitoBundleStatusResponse {
  status: "Pending" | "Landed" | "Failed" | string;
  landed_slot?: number;
  error?: string;
}

export class JitoService {
  private static async rpcCall<T>(method: string, params: unknown[]): Promise<T> {
    const response = await fetch(config.jito.blockEngineUrl, {
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
      throw new AppError(
        `Jito relay request failed with status ${response.status}`,
        502,
      );
    }

    const json = (await response.json()) as {
      result?: T;
      error?: { code: number; message: string };
    };

    if (json.error) {
      throw new AppError(
        `Jito relay error (${json.error.code}): ${json.error.message}`,
        502,
      );
    }

    if (!json.result) {
      throw new AppError("Jito relay returned empty result", 502);
    }

    return json.result;
  }

  static serializeBundleTransactions(
    transactions: VersionedTransaction[],
  ): string[] {
    return transactions.map((tx) => Buffer.from(tx.serialize()).toString("base64"));
  }

  static async getTipAccount(): Promise<string> {
    const accounts = await this.rpcCall<string[]>("getTipAccounts", []);
    if (!accounts.length) {
      throw new AppError("No Jito tip accounts available", 502);
    }
    return accounts[0];
  }

  static async sendBundle(transactions: VersionedTransaction[]): Promise<string> {
    const encoded = this.serializeBundleTransactions(transactions);
    const result = await this.rpcCall<{ bundle_id: string } | string>(
      "sendBundle",
      [encoded],
    );

    if (typeof result === "string") {
      return result;
    }

    if (!result.bundle_id) {
      throw new AppError("Jito bundle id missing in response", 502);
    }

    return result.bundle_id;
  }

  static async getInflightBundleStatus(
    bundleId: string,
  ): Promise<JitoBundleStatusResponse> {
    const result = await this.rpcCall<{
      value?: Array<{
        bundle_id: string;
        status: string;
        landed_slot?: number;
        error?: string;
      }>;
    }>("getInflightBundleStatuses", [[bundleId]]);

    const status = result.value?.[0];
    if (!status) return { status: "Pending" };

    return {
      status: status.status,
      landed_slot: status.landed_slot,
      error: status.error,
    };
  }

  static async waitForBundleFinalStatus(bundleId: string): Promise<string> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < config.jito.statusTimeoutMs) {
      const status = await this.getInflightBundleStatus(bundleId);

      if (status.status === "Landed") return "landed";
      if (status.status === "Failed") {
        throw new AppError(
          `Jito bundle failed: ${status.error || "unknown error"}`,
          500,
        );
      }

      await new Promise((resolve) =>
        setTimeout(resolve, config.jito.statusPollIntervalMs),
      );
    }

    return "timeout";
  }
}
