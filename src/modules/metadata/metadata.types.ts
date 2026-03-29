export interface TokenMetadataRecord {
  id: number;
  metadata_id: string;
  name: string;
  symbol: string;
  description: string;
  image_filename: string;
  image_url: string;
  metadata_url: string;
  show_name: number;
  created_on: string;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  group_tag: string | null;
  created_at: string;
}

export interface TokenMetadataPublicInfo {
  id: number;
  metadataId: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  metadataUrl: string;
  showName: boolean;
  createdOn: string;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  groupTag: string | null;
  createdAt: string;
}

export interface TokenMetadataJson {
  name: string;
  symbol: string;
  description: string;
  image: string;
  showName: boolean;
  createdOn: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}

export interface CreateMetadataOptions {
  name: string;
  symbol: string;
  description?: string;
  imageSource: "upload" | "url";
  imageUrl?: string;
  showName?: boolean;
  createdOn?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  groupTag?: string;
}

export interface CreateMetadataResult {
  metadata: TokenMetadataPublicInfo;
  imageUrl: string;
  metadataUrl: string;
  metadataJson: TokenMetadataJson;
}
