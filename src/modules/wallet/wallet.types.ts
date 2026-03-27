export interface WalletRecord {
  id: number;
  public_key: string;
  encrypted_private_key: string;
  group_tag: string | null;
  is_active: number;
  balance_lamports: number;
  last_balance_check: string | null;
  created_at: string;
  updated_at: string;
}

export interface WalletPublicInfo {
  id: number;
  publicKey: string;
  groupTag: string | null;
  isActive: boolean;
  balanceLamports: number;
  balanceSol: number;
  lastBalanceCheck: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WalletWithPrivateKey extends WalletPublicInfo {
  privateKeyBase58: string;
}

export interface GenerateWalletOptions {
  groupTag?: string;
}

export interface BatchGenerateOptions {
  count: number;
  groupTag?: string;
}

export interface ImportWalletOptions {
  privateKeyBase58: string;
  groupTag?: string;
}

export interface FundWalletOptions {
  publicKey: string;
  amountSol?: number;
}

export interface WalletTransactionRecord {
  id: number;
  wallet_id: number;
  signature: string;
  tx_type: string;
  amount_lamports: number;
  status: string;
  created_at: string;
}

export interface BatchExportResult {
  groupTag: string;
  count: number;
  wallets: WalletWithPrivateKey[];
}
