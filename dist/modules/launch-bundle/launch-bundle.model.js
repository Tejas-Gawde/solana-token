"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaunchBundleModel = void 0;
const database_ts_1 = require("../../config/database.ts");
function toPublicInfo(record) {
    return {
        launchBundleId: record.launch_bundle_id,
        bundleId: record.bundle_id || "",
        status: record.status,
        mintAddress: record.mint_address,
        lookupTableAddress: record.lookup_table_address,
        launchTxSignature: record.launch_tx_signature,
        buyerTxSignatures: record.buyer_tx_signatures
            ? JSON.parse(record.buyer_tx_signatures)
            : [],
        tipTxSignature: record.tip_tx_signature,
        errorMessage: record.error_message,
        requestPayload: record.request_payload
            ? JSON.parse(record.request_payload)
            : null,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
    };
}
class LaunchBundleModel {
    static create(data) {
        const db = (0, database_ts_1.getDatabase)();
        db.prepare(`INSERT INTO launch_bundles (
        launch_bundle_id, distribution_id, creator_wallet, user_wallet, status, request_payload
      ) VALUES (
        @launchBundleId, @distributionId, @creatorWallet, @userWallet, 'pending', @requestPayload
      )`).run({
            launchBundleId: data.launchBundleId,
            distributionId: data.distributionId,
            creatorWallet: data.creatorWallet,
            userWallet: data.userWallet,
            requestPayload: JSON.stringify(data.requestPayload),
        });
    }
    static updateSuccess(launchBundleId, data) {
        const db = (0, database_ts_1.getDatabase)();
        db.prepare(`UPDATE launch_bundles
       SET bundle_id = @bundleId,
           status = @status,
           mint_address = @mintAddress,
           lookup_table_address = @lookupTableAddress,
           create_lut_signature = @createLutSignature,
           extend_lut_signatures = @extendLutSignatures,
           launch_tx_signature = @launchTxSignature,
           buyer_tx_signatures = @buyerTxSignatures,
           tip_tx_signature = @tipTxSignature,
           updated_at = datetime('now')
       WHERE launch_bundle_id = @launchBundleId`).run({
            launchBundleId,
            bundleId: data.bundleId,
            status: data.status,
            mintAddress: data.mintAddress,
            lookupTableAddress: data.lookupTableAddress,
            createLutSignature: data.createLutSignature,
            extendLutSignatures: JSON.stringify(data.extendLutSignatures),
            launchTxSignature: data.launchTxSignature,
            buyerTxSignatures: JSON.stringify(data.buyerTxSignatures),
            tipTxSignature: data.tipTxSignature,
        });
    }
    static updateFailure(launchBundleId, errorMessage) {
        const db = (0, database_ts_1.getDatabase)();
        db.prepare(`UPDATE launch_bundles
       SET status = 'failed',
           error_message = @errorMessage,
           updated_at = datetime('now')
       WHERE launch_bundle_id = @launchBundleId`).run({
            launchBundleId,
            errorMessage,
        });
    }
    static findByLaunchBundleId(launchBundleId) {
        const db = (0, database_ts_1.getDatabase)();
        const row = db
            .prepare("SELECT * FROM launch_bundles WHERE launch_bundle_id = ?")
            .get(launchBundleId);
        if (!row)
            return undefined;
        return toPublicInfo(row);
    }
}
exports.LaunchBundleModel = LaunchBundleModel;
