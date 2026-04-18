import { getDatabase } from "../../config/database.ts";
import type { DistributionRecord } from "./distribute.types.ts";
import { logger } from "../../utils/logger.ts";

export class DistributeModel {
  static create(data: {
    distributionId: string;
    mainWallet: string;
    numWallets: number;
    solPerWallet: number;
    totalSol: number;
    bWalletsGroupTag: string;
    cWalletsGroupTag: string;
    groupTag?: string;
  }): DistributionRecord {
    const db = getDatabase();

    const stmt = db.prepare(`
      INSERT INTO distributions (
        distribution_id, main_wallet, num_wallets, sol_per_wallet,
        total_sol, b_wallets_group_tag, c_wallets_group_tag,
        status, group_tag
      )
      VALUES (
        @distributionId, @mainWallet, @numWallets, @solPerWallet,
        @totalSol, @bWalletsGroupTag, @cWalletsGroupTag,
        'pending', @groupTag
      )
    `);

    const result = stmt.run({
      distributionId: data.distributionId,
      mainWallet: data.mainWallet,
      numWallets: data.numWallets,
      solPerWallet: data.solPerWallet,
      totalSol: data.totalSol,
      bWalletsGroupTag: data.bWalletsGroupTag,
      cWalletsGroupTag: data.cWalletsGroupTag,
      groupTag: data.groupTag || null,
    });

    logger.debug(`Distribution created: ${data.distributionId}`);
    return this.findById(result.lastInsertRowid as number)!;
  }

  static updateStep1(distributionId: string, txSignature: string): void {
    const db = getDatabase();
    db.prepare(
      "UPDATE distributions SET step1_tx_signature = ? WHERE distribution_id = ?"
    ).run(txSignature, distributionId);
  }

  static updateStep2(distributionId: string, txSignatures: string[]): void {
    const db = getDatabase();
    db.prepare(
      "UPDATE distributions SET step2_tx_signatures = ? WHERE distribution_id = ?"
    ).run(JSON.stringify(txSignatures), distributionId);
  }

  static updateStatus(distributionId: string, status: string): void {
    const db = getDatabase();
    db.prepare(
      "UPDATE distributions SET status = ? WHERE distribution_id = ?"
    ).run(status, distributionId);
  }

  static findById(id: number): DistributionRecord | undefined {
    const db = getDatabase();
    return db
      .prepare("SELECT * FROM distributions WHERE id = ?")
      .get(id) as DistributionRecord | undefined;
  }

  static findByDistributionId(distributionId: string): DistributionRecord | undefined {
    const db = getDatabase();
    return db
      .prepare("SELECT * FROM distributions WHERE distribution_id = ?")
      .get(distributionId) as DistributionRecord | undefined;
  }

  static list(options: {
    groupTag?: string;
    mainWallet?: string;
    status?: string;
    page: number;
    limit: number;
  }): { distributions: DistributionRecord[]; total: number } {
    const db = getDatabase();

    const conditions: string[] = [];
    const params: Record<string, any> = {};

    if (options.groupTag) {
      conditions.push("group_tag = @groupTag");
      params.groupTag = options.groupTag;
    }
    if (options.mainWallet) {
      conditions.push("main_wallet = @mainWallet");
      params.mainWallet = options.mainWallet;
    }
    if (options.status) {
      conditions.push("status = @status");
      params.status = options.status;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (options.page - 1) * options.limit;

    const { total } = db
      .prepare(`SELECT COUNT(*) as total FROM distributions ${whereClause}`)
      .get(params) as { total: number };

    const distributions = db
      .prepare(
        `SELECT * FROM distributions ${whereClause} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit: options.limit, offset }) as DistributionRecord[];

    return { distributions, total };
  }

  // ==================== TEMP B WALLETS ====================

  /**
   * Store a single temp B wallet
   */
  static createTempWallet(data: {
    publicKey: string;
    encryptedPrivateKey: string;
    distributionId: string;
    walletIndex: number;
  }): void {
    const db = getDatabase();

    db.prepare(`
      INSERT INTO wallets_temp_distribute (
        public_key, encrypted_private_key, distribution_id, wallet_index
      )
      VALUES (@publicKey, @encryptedPrivateKey, @distributionId, @walletIndex)
    `).run({
      publicKey: data.publicKey,
      encryptedPrivateKey: data.encryptedPrivateKey,
      distributionId: data.distributionId,
      walletIndex: data.walletIndex,
    });
  }

  /**
   * Batch store temp B wallets in a single transaction
   */
  static createTempWalletsBatch(
    wallets: Array<{
      publicKey: string;
      encryptedPrivateKey: string;
      distributionId: string;
      walletIndex: number;
    }>
  ): void {
    const db = getDatabase();

    const stmt = db.prepare(`
      INSERT INTO wallets_temp_distribute (
        public_key, encrypted_private_key, distribution_id, wallet_index
      )
      VALUES (@publicKey, @encryptedPrivateKey, @distributionId, @walletIndex)
    `);

    const insertMany = db.transaction(
      (items: typeof wallets) => {
        for (const item of items) {
          stmt.run({
            publicKey: item.publicKey,
            encryptedPrivateKey: item.encryptedPrivateKey,
            distributionId: item.distributionId,
            walletIndex: item.walletIndex,
          });
        }
      }
    );

    insertMany(wallets);
  }

  /**
   * Get all temp B wallets for a distribution
   */
  static getTempWalletsByDistribution(
    distributionId: string
  ): Array<{ public_key: string; wallet_index: number }> {
    const db = getDatabase();
    return db
      .prepare(
        "SELECT public_key, wallet_index FROM wallets_temp_distribute WHERE distribution_id = ? ORDER BY wallet_index ASC"
      )
      .all(distributionId) as Array<{ public_key: string; wallet_index: number }>;
  }

  /**
   * Delete temp B wallets for a completed distribution (cleanup)
   */
  static deleteTempWallets(distributionId: string): number {
    const db = getDatabase();
    const result = db
      .prepare("DELETE FROM wallets_temp_distribute WHERE distribution_id = ?")
      .run(distributionId);
    return result.changes;
  }

  /**
   * Count temp wallets across all distributions
   */
  static countTempWallets(): number {
    const db = getDatabase();
    const { total } = db
      .prepare("SELECT COUNT(*) as total FROM wallets_temp_distribute")
      .get() as { total: number };
    return total;
  }
}