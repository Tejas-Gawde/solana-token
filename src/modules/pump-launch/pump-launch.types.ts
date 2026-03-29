export interface PumpLaunchRecord {
  id: number;
  mint_address: string;
  creator_wallet: string;
  name: string;
  symbol: string;
  description: string | null;
  image_url: string | null;
  metadata_uri: string | null;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  initial_buy_sol: number | null;
  group_tag: string | null;
  create_tx_signature: string;
  status: string;
  created_at: string;
}

export interface PumpLaunchPublicInfo {
  id: number;
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
  createdAt: string;
}

export interface CreatePumpLaunchOptions {
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
  mayhemMode?: boolean;
  cashback?: boolean;
}

export interface UpdatePumpLaunchOptions {
  status?: "pending" | "created" | "failed" | "active" | "cancelled";
  description?: string;
  imageUrl?: string;
  metadataUri?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  initialBuySol?: number;
  groupTag?: string;
}

export interface PumpLaunchListOptions {
  creatorWallet?: string;
  status?: string;
  groupTag?: string;
  page: number;
  limit: number;
}
