import { birdeyeGet } from "./client";
import type {
  TimeWindow,
  BirdeyePnlSummary,
  BirdeyeTokenPnl,
  BirdeyeNetWorthPoint,
  BirdeyeHolding,
  BirdeyeFirstFunded,
  BirdeyeTokenMetadata,
  BirdeyeTokenMarketData,
  BirdeyeTokenSecurity,
  BirdeyeTraderRow,
} from "./types";

type TraderGainersLosersType = "today" | "yesterday" | "1W";

function toTraderGainersLosersType(window: TimeWindow): TraderGainersLosersType {
  switch (window) {
    case "24h":
      return "today";
    case "7d":
      return "1W";
    case "30d":
      // The endpoint currently supports only today/yesterday/1W.
      return "1W";
    default:
      return "today";
  }
}

function extractItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const rec = data as Record<string, unknown>;
  if (rec?.items && Array.isArray(rec.items)) return rec.items;
  if (rec?.tokens && Array.isArray(rec.tokens)) return rec.tokens;
  if (rec?.traders && Array.isArray(rec.traders)) return rec.traders;
  return [];
}

function mapPnlSummary(raw: unknown): BirdeyePnlSummary {
  const d = raw as Record<string, unknown>;
  return {
    wallet: (d.wallet as string) || "",
    totalPnlUsd: Number(d.totalPnlUsd ?? d.total_pnl_usd ?? 0),
    totalPnlPercent: Number(d.totalPnlPercent ?? d.total_pnl_percent ?? 0),
    realizedPnlUsd: Number(d.realizedPnlUsd ?? d.realized_pnl_usd ?? 0),
    unrealizedPnlUsd: Number(d.unrealizedPnlUsd ?? d.unrealized_pnl_usd ?? 0),
    roiPercent: Number(d.roiPercent ?? d.roi_percent ?? 0),
    winRate: Number(d.winRate ?? d.win_rate ?? 0),
    tradeCount: Number(d.tradeCount ?? d.trade_count ?? 0),
    volumeUsd: Number(d.volumeUsd ?? d.volume_usd ?? 0),
  };
}

function mapTokenPnl(raw: unknown): BirdeyeTokenPnl {
  const d = raw as Record<string, unknown>;
  return {
    tokenAddress: (d.address as string) || (d.tokenAddress as string) || "",
    symbol: (d.symbol as string) || "",
    name: (d.name as string) || "",
    logoUri: (d.logoURI as string) || (d.logoUri as string) || "",
    realizedPnlUsd: Number(d.realizedPnlUsd ?? d.realized_pnl_usd ?? 0),
    unrealizedPnlUsd: Number(d.unrealizedPnlUsd ?? d.unrealized_pnl_usd ?? 0),
    roiPercent: Number(d.roiPercent ?? d.roi_percent ?? 0),
    buyCount: Number(d.buyCount ?? d.buy_count ?? 0),
    sellCount: Number(d.sellCount ?? d.sell_count ?? 0),
    volumeUsd: Number(d.volumeUsd ?? d.volume_usd ?? 0),
    lastActivityAt: (d.lastActivityAt as string) ?? (d.last_activity_at as string) ?? null,
  };
}

export async function getWalletPnlSummary(
  wallet: string,
  window: TimeWindow
): Promise<BirdeyePnlSummary> {
  const data = await birdeyeGet<unknown>("/wallet/v2/pnl/summary", {
    wallet,
    time_window: window,
  });
  return mapPnlSummary(data);
}

export async function getWalletPnlDetails(
  wallet: string,
  window: TimeWindow
): Promise<BirdeyeTokenPnl[]> {
  const data = await birdeyeGet<unknown>("/wallet/v2/pnl/details", {
    wallet,
    time_window: window,
  });
  return extractItems(data).map(mapTokenPnl);
}

export async function getWalletNetWorth(
  wallet: string,
  window: TimeWindow
): Promise<BirdeyeNetWorthPoint[]> {
  const data = await birdeyeGet<unknown>("/wallet/v2/net-worth", {
    wallet,
    time_window: window,
  });
  return extractItems(data).map((d: unknown) => {
    const r = d as Record<string, unknown>;
    return {
      timestamp: Number(r.timestamp ?? r.time ?? 0),
      valueUsd: Number(r.valueUsd ?? r.value_usd ?? r.value ?? 0),
    };
  });
}

export async function getWalletTokenList(
  wallet: string
): Promise<BirdeyeHolding[]> {
  const data = await birdeyeGet<unknown>("/v1/wallet/token_list", { wallet });
  return extractItems(data).map((d: unknown) => {
    const r = d as Record<string, unknown>;
    return {
      tokenAddress: (r.address as string) || (r.tokenAddress as string) || (r.mint as string) || "",
      symbol: (r.symbol as string) || "",
      name: (r.name as string) || "",
      logoUri: (r.logoURI as string) || (r.logoUri as string) || "",
      balance: Number(r.balance ?? r.amount ?? 0),
      valueUsd: Number(r.valueUsd ?? r.value_usd ?? r.usdValue ?? 0),
      portfolioWeight: Number(r.portfolioWeight ?? r.portfolio_weight ?? r.percent ?? 0),
    };
  });
}

export async function getWalletFirstFunded(
  wallet: string
): Promise<BirdeyeFirstFunded> {
  const data = await birdeyeGet<unknown>("/wallet/v2/tx/first-funded", {
    wallet,
  });
  const r = data as Record<string, unknown>;
  const firstFundedAt = (r.firstFundedAt ?? r.first_funded_at ?? null) as string | null;
  let walletAgeDays: number | null = null;
  if (firstFundedAt) {
    const diff = Date.now() - new Date(firstFundedAt).getTime();
    walletAgeDays = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }
  return { wallet, firstFundedAt, walletAgeDays };
}

export async function getTokenMetadata(
  tokenAddresses: string[]
): Promise<BirdeyeTokenMetadata[]> {
  if (tokenAddresses.length === 0) return [];
  const data = await birdeyeGet<unknown>("/defi/v3/token/meta-data/multiple", {
    list_token: tokenAddresses.join(","),
  });
  const items: unknown[] = Array.isArray(data) ? data : Object.values(data as Record<string, unknown>);
  return items.map((d: unknown) => {
    const r = d as Record<string, unknown>;
    return {
      address: (r.address as string) || (r.mint as string) || "",
      symbol: (r.symbol as string) || "",
      name: (r.name as string) || "",
      logoUri: (r.logoURI as string) || (r.logoUri as string) || "",
      decimals: Number(r.decimals ?? 0),
      chain: (r.chain as string) || "solana",
    };
  });
}

export async function getTokenMarketData(
  token: string
): Promise<BirdeyeTokenMarketData> {
  const data = await birdeyeGet<unknown>("/defi/v3/token/market-data", {
    address: token,
  });
  const r = (Array.isArray(data) ? (data as unknown[])[0] : data) as Record<string, unknown>;
  return {
    address: (r.address as string) || token,
    symbol: (r.symbol as string) || "",
    price: Number(r.price ?? 0),
    liquidityUsd: Number(r.liquidity ?? r.liquidityUsd ?? r.liquidity_usd ?? 0),
    volume24h: Number(r.volume24h ?? r.volume_24h ?? 0),
    marketCap: Number(r.marketCap ?? r.market_cap ?? r.mc ?? 0),
  };
}

export async function getTokenSecurity(
  token: string
): Promise<BirdeyeTokenSecurity> {
  const data = await birdeyeGet<unknown>("/defi/token_security", {
    address: token,
  });
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    address: token,
    isHoneypot: (r.isHoneypot as boolean | null) ?? null,
    buyTax: (r.buyTax as number | null) ?? null,
    sellTax: (r.sellTax as number | null) ?? null,
    isMintable: (r.isMintable as boolean | null) ?? null,
    isFreezable: (r.isFreezable as boolean | null) ?? null,
    topHolderPercent: (r.topHolderPercent as number | null) ?? null,
  };
}

export async function getTraderGainersLosers(
  window: TimeWindow
): Promise<BirdeyeTraderRow[]> {
  const type = toTraderGainersLosersType(window);

  const data = await birdeyeGet<unknown>("/trader/gainers-losers", {
    type,
    sort_by: "PnL",
    sort_type: "desc",
  });
  return extractItems(data).map((d: unknown) => {
    const r = d as Record<string, unknown>;
    return {
      wallet: (r.address as string) || (r.wallet as string) || (r.owner as string) || "",
      pnlUsd: Number(r.pnlUsd ?? r.pnl_usd ?? r.pnl ?? 0),
      roiPercent: Number(r.roiPercent ?? r.roi_percent ?? r.roi ?? 0),
      winRate: Number(r.winRate ?? r.win_rate ?? 0),
      tradeCount: Number(r.tradeCount ?? r.trade_count ?? 0),
      volumeUsd: Number(r.volumeUsd ?? r.volume_usd ?? 0),
    };
  });
}
