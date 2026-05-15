export type TimeWindow = "24h" | "7d" | "30d";

export interface BirdeyePnlSummary {
  wallet: string;
  totalPnlUsd: number;
  totalPnlPercent: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  roiPercent: number;
  winRate: number;
  tradeCount: number;
  volumeUsd: number;
}

export interface BirdeyeTokenPnl {
  tokenAddress: string;
  symbol: string;
  name: string;
  logoUri: string;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  roiPercent: number;
  buyCount: number;
  sellCount: number;
  volumeUsd: number;
  lastActivityAt: string | null;
}

export interface BirdeyeNetWorthPoint {
  timestamp: number;
  valueUsd: number;
}

export interface BirdeyeHolding {
  tokenAddress: string;
  symbol: string;
  name: string;
  logoUri: string;
  balance: number;
  valueUsd: number;
  portfolioWeight: number;
}

export interface BirdeyeFirstFunded {
  wallet: string;
  firstFundedAt: string | null;
  walletAgeDays: number | null;
}

export interface BirdeyeTokenMetadata {
  address: string;
  symbol: string;
  name: string;
  logoUri: string;
  decimals: number;
  chain: string;
}

export interface BirdeyeTokenMarketData {
  address: string;
  symbol: string;
  price: number;
  liquidityUsd: number;
  volume24h: number;
  marketCap: number;
}

export interface BirdeyeTokenSecurity {
  address: string;
  isHoneypot: boolean | null;
  buyTax: number | null;
  sellTax: number | null;
  isMintable: boolean | null;
  isFreezable: boolean | null;
  topHolderPercent: number | null;
}

export interface BirdeyeTraderRow {
  wallet: string;
  pnlUsd: number;
  roiPercent: number;
  winRate: number;
  tradeCount: number;
  volumeUsd: number;
}

export interface BirdeyeGainersLosersResponse {
  traders: BirdeyeTraderRow[];
}
