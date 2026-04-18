export interface DistributionRecord {
  id: number;
  distribution_id: string;
  main_wallet: string;
  num_wallets: number;
  sol_per_wallet: number;
  total_sol: number;
  step1_tx_signature: string | null;
  step2_tx_signatures: string | null;
  b_wallets_group_tag: string;
  c_wallets_group_tag: string;
  status: string;
  group_tag: string | null;
  created_at: string;
}

export interface DistributionPublicInfo {
  id: number;
  distributionId: string;
  mainWallet: string;
  numWallets: number;
  solPerWallet: number;
  totalSol: number;
  step1TxSignature: string | null;
  step2TxSignatures: string[];
  bWalletsGroupTag: string;
  cWalletsGroupTag: string;
  status: string;
  groupTag: string | null;
  createdAt: string;
}

export interface DistributeOptions {
  mainWalletPublicKey: string;
  numWallets: number;
  solPerWallet: number;
  groupTag?: string;
}

export interface DistributeResult {
  distributionId: string;
  mainWallet: string;
  bWallets: string[];
  cWallets: string[];
  bWalletsGroupTag: string;
  cWalletsGroupTag: string;
  solPerWallet: number;
  totalSol: number;
  step1TxSignature: string;
  step2TxSignatures: string[];
}