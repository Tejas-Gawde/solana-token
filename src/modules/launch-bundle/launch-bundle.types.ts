export interface BundleBuyerConfig {
  walletPublicKey: string;
  buySolAmount: number;
  slippage?: number;
}

export interface LaunchBundleOptions {
  creatorPublicKey: string;
  userPublicKey: string;
  distributionId?: string;
  name: string;
  symbol: string;
  uri: string;
  mintPrivateKey?: number[];
  mayhemMode?: boolean;
  cashback?: boolean;
  buyers: BundleBuyerConfig[];
  jitoTipSol?: number;
}

export interface LaunchBundleResult {
  launchBundleId: string;
  bundleId: string;
  mintAddress: string;
  lookupTableAddress: string;
  createLutSignature: string;
  extendLutSignatures: string[];
  launchTxSignature: string;
  buyerTxSignatures: string[];
  tipTxSignature: string;
  buyerWallets: string[];
  status: string;
}

export interface LaunchBundlePublicInfo {
  launchBundleId: string;
  bundleId: string;
  status: string;
  mintAddress: string | null;
  lookupTableAddress: string | null;
  launchTxSignature: string | null;
  buyerTxSignatures: string[];
  tipTxSignature: string | null;
  errorMessage: string | null;
  requestPayload: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface LaunchBundleRecord {
  id: number;
  launch_bundle_id: string;
  distribution_id: string;
  creator_wallet: string;
  user_wallet: string;
  bundle_id: string | null;
  status: string;
  mint_address: string | null;
  lookup_table_address: string | null;
  create_lut_signature: string | null;
  extend_lut_signatures: string | null;
  launch_tx_signature: string | null;
  buyer_tx_signatures: string | null;
  tip_tx_signature: string | null;
  request_payload: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
