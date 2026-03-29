import { getDatabase } from "../../config/database.ts";
import type { PumpLaunchRecord } from "./pump-launch.types.ts";
import { logger } from "../../utils/logger.ts";

export class PumpLaunchModel {
  static create(data: {
    mintAddress: string;
    creatorWallet: string;
    name: string;
    symbol: string;
    description?: string;
    imageUrl?: string;
    metadataUri?: string;
    twitter?: string;
    telegram?: string;
    website?: string;
    initialBuySol?: number;
    groupTag?: string;
    createTxSignature: string;
    status: string;
  }): PumpLaunchRecord {
    const db = getDatabase();

    const stmt = db.prepare(`
      INSERT INTO pump_launches (
        mint_address,
        creator_wallet,
        name,
        symbol,
        description,
        image_url,
        metadata_uri,
        twitter,
        telegram,
        website,
        initial_buy_sol,
        group_tag,
        create_tx_signature,
        status
      ) VALUES (
        @mintAddress,
        @creatorWallet,
        @name,
        @symbol,
        @description,
        @imageUrl,
        @metadataUri,
        @twitter,
        @telegram,
        @website,
        @initialBuySol,
        @groupTag,
        @createTxSignature,
        @status
      )
    `);

    const result = stmt.run({
      mintAddress: data.mintAddress,
      creatorWallet: data.creatorWallet,
      name: data.name,
      symbol: data.symbol,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      metadataUri: data.metadataUri || null,
      twitter: data.twitter || null,
      telegram: data.telegram || null,
      website: data.website || null,
      initialBuySol:
        typeof data.initialBuySol === "number" ? data.initialBuySol : null,
      groupTag: data.groupTag || null,
      createTxSignature: data.createTxSignature,
      status: data.status,
    });

    logger.info(`Pump launch queued: ${data.mintAddress}`);

    return this.findById(result.lastInsertRowid as number)!;
  }

  static findById(id: number): PumpLaunchRecord | undefined {
    const db = getDatabase();
    const stmt = db.prepare("SELECT * FROM pump_launches WHERE id = ?");
    return stmt.get(id) as PumpLaunchRecord | undefined;
  }

  static findByMintAddress(mintAddress: string): PumpLaunchRecord | undefined {
    const db = getDatabase();
    const stmt = db.prepare(
      "SELECT * FROM pump_launches WHERE mint_address = ?",
    );
    return stmt.get(mintAddress) as PumpLaunchRecord | undefined;
  }

  static list(options: {
    creatorWallet?: string;
    status?: string;
    groupTag?: string;
    page: number;
    limit: number;
  }): { launches: PumpLaunchRecord[]; total: number } {
    const db = getDatabase();
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options.creatorWallet) {
      conditions.push("creator_wallet = @creatorWallet");
      params.creatorWallet = options.creatorWallet;
    }
    if (options.status) {
      conditions.push("status = @status");
      params.status = options.status;
    }
    if (options.groupTag) {
      conditions.push("group_tag = @groupTag");
      params.groupTag = options.groupTag;
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";
    const offset = (options.page - 1) * options.limit;

    const countStmt = db.prepare(
      `SELECT COUNT(*) as total FROM pump_launches ${whereClause}`,
    );
    const { total } = countStmt.get(params) as { total: number };

    const listStmt = db.prepare(
      `SELECT * FROM pump_launches ${whereClause} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`,
    );

    const launches = listStmt.all({
      ...params,
      limit: options.limit,
      offset,
    }) as PumpLaunchRecord[];
    return { launches, total };
  }

  static update(
    mintAddress: string,
    data: Partial<Omit<PumpLaunchRecord, "id" | "created_at" | "mint_address">>,
  ): PumpLaunchRecord | undefined {
    const db = getDatabase();

    const existing = this.findByMintAddress(mintAddress);
    if (!existing) {
      return undefined;
    }

    const updates: string[] = [];
    const params: Record<string, unknown> = { mintAddress };

    if (data.name !== undefined) {
      updates.push("name = @name");
      params.name = data.name;
    }
    if (data.symbol !== undefined) {
      updates.push("symbol = @symbol");
      params.symbol = data.symbol;
    }
    if (data.description !== undefined) {
      updates.push("description = @description");
      params.description = data.description;
    }
    if (data.image_url !== undefined) {
      updates.push("image_url = @image_url");
      params.image_url = data.image_url;
    }
    if (data.metadata_uri !== undefined) {
      updates.push("metadata_uri = @metadata_uri");
      params.metadata_uri = data.metadata_uri;
    }
    if (data.twitter !== undefined) {
      updates.push("twitter = @twitter");
      params.twitter = data.twitter;
    }
    if (data.telegram !== undefined) {
      updates.push("telegram = @telegram");
      params.telegram = data.telegram;
    }
    if (data.website !== undefined) {
      updates.push("website = @website");
      params.website = data.website;
    }
    if (data.initial_buy_sol !== undefined) {
      updates.push("initial_buy_sol = @initial_buy_sol");
      params.initial_buy_sol = data.initial_buy_sol;
    }
    if (data.group_tag !== undefined) {
      updates.push("group_tag = @group_tag");
      params.group_tag = data.group_tag;
    }
    if (data.create_tx_signature !== undefined) {
      updates.push("create_tx_signature = @create_tx_signature");
      params.create_tx_signature = data.create_tx_signature;
    }
    if (data.status !== undefined) {
      updates.push("status = @status");
      params.status = data.status;
    }

    if (updates.length === 0) {
      return existing;
    }

    const stmt = db.prepare(
      `UPDATE pump_launches SET ${updates.join(", ")} WHERE mint_address = @mintAddress`,
    );
    stmt.run(params);

    logger.info(`Pump launch updated: ${mintAddress}`);
    return this.findByMintAddress(mintAddress);
  }
}
