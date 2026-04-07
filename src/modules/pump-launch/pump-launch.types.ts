export interface LaunchPumpTokenOptions {
  creatorPublicKey: string;
  userPublicKey: string;
  name: string;
  symbol: string;
  uri: string;
  mintPrivateKey?: number[];
  mayhemMode?: boolean;
  cashback?: boolean;
  initialBuySol?: number;
  slippage?: number;
}

export interface LaunchPumpTokenResult {
  action: "created" | "created_with_buy";
  mintAddress: string;
  txSignature: string;
  purchasedTokenAmountRaw?: string;
  spentSolLamports?: string;
}

export interface BuyFromBondingCurveOptions {
  mintAddress: string;
  userPublicKey: string;
  buySolAmount?: number;
  buyTokenAmountRaw?: string;
  slippage?: number;
}

export interface BuyFromBondingCurveResult {
  mintAddress: string;
  txSignature: string;
  purchasedTokenAmountRaw: string;
  spentSolLamports: string;
  slippageBps: number;
}

export interface MigrateBondingCurveOptions {
  mintAddress: string;
  userPublicKey: string;
}

export interface MigrateBondingCurveResult {
  mintAddress: string;
  txSignature: string;
}

export interface PumpLaunchBondingCurveInfo {
  mintAddress: string;
  tokenProgram: string;
  mintSupply: string;
  global: Record<string, unknown>;
  feeConfig: Record<string, unknown>;
  bondingCurve: Record<string, unknown>;
}
