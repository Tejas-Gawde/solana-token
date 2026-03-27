export interface TokenRecord {
  id: number;
  mint_address: string;
  creator_wallet: string;
  decimals: number;
  initial_supply: string;
  initial_supply_raw: string;
  mint_authority: string;
  freeze_authority: string | null;
  group_tag: string | null;
  tx_signature: string;
  name: string | null;
  symbol: string | null;
  uri: string | null;
  metadata_tx_signature: string | null;
  created_at: string;
}

export interface TokenPublicInfo {
  id: number;
  mintAddress: string;
  creatorWallet: string;
  decimals: number;
  initialSupply: string;
  initialSupplyRaw: string;
  mintAuthority: string;
  freezeAuthority: string | null;
  groupTag: string | null;
  txSignature: string;
  name: string | null;
  symbol: string | null;
  uri: string | null;
  metadataTxSignature: string | null;
  createdAt: string;
}

export interface TokenWithPrivateKey extends TokenPublicInfo {
  privateKeyBase58: string;
}

export interface CreateTokenOptions {
  creatorPublicKey: string;
  decimals?: number;
  initialSupply: number;
  groupTag?: string;
  freezeAuthority?: boolean;
}

export interface CreateTokenResult {
  token: TokenPublicInfo;
  mintAddress: string;
  associatedTokenAccount: string;
  txSignature: string;
  initialSupply: number;
  decimals: number;
}

export interface AddMetadataOptions {
  mintAddress: string;
  creatorPublicKey: string;
  name: string;
  symbol: string;
  uri: string;
}

export interface AddMetadataResult {
  token: TokenPublicInfo;
  mintAddress: string;
  metadataTxSignature: string;
  name: string;
  symbol: string;
  uri: string;
}

export interface CreateTokenWithMetadataOptions {
  creatorPublicKey: string;
  decimals?: number;
  initialSupply: number;
  name: string;
  symbol: string;
  uri: string;
  groupTag?: string;
  freezeAuthority?: boolean;
}

export interface CreateTokenWithMetadataResult {
  token: TokenPublicInfo;
  mintAddress: string;
  associatedTokenAccount: string;
  txSignature: string;
  metadataTxSignature: string;
  initialSupply: number;
  decimals: number;
  name: string;
  symbol: string;
  uri: string;
}
