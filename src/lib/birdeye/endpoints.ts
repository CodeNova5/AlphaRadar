import { birdeyeGet } from "./client";
import { BirdeyeError } from "./client";
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

let firstFundedDisabledUntil = 0;
let tokenListDisabledUntil = 0;

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

function parseNumeric(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const trimmed = value.trim().replace(/[$,]/g, "");
  if (!trimmed) {
    return 0;
  }

  const suffixMatch = trimmed.match(/^(-?[\d.]+)\s*([kKmMbB])$/);
  if (suffixMatch) {
    const base = Number(suffixMatch[1]);
    if (!Number.isFinite(base)) {
      return 0;
    }

    const suffix = suffixMatch[2].toLowerCase();
    const multiplier = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : 1_000_000_000;
    return base * multiplier;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readNumeric(record: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) {
      const parsed = parseNumeric(value);
      if (parsed !== 0 || value === 0 || value === "0") {
        return parsed;
      }
    }
  }

  return 0;
}

function mapPnlSummary(raw: unknown): BirdeyePnlSummary {
  const d = raw as Record<string, unknown>;
  return {
    wallet: (d.wallet as string) || "",
    totalPnlUsd: readNumeric(d, ["totalPnlUsd", "total_pnl_usd", "totalPnl", "total_pnl", "pnlUsd", "pnl_usd", "pnl"]),
    totalPnlPercent: readNumeric(d, ["totalPnlPercent", "total_pnl_percent"]),
    realizedPnlUsd: readNumeric(d, ["realizedPnlUsd", "realized_pnl_usd", "realizedPnl", "realized_pnl"]),
    unrealizedPnlUsd: readNumeric(d, ["unrealizedPnlUsd", "unrealized_pnl_usd", "unrealizedPnl", "unrealized_pnl"]),
    roiPercent: readNumeric(d, ["roiPercent", "roi_percent", "roi"]),
    winRate: readNumeric(d, ["winRate", "win_rate"]),
    tradeCount: readNumeric(d, ["tradeCount", "trade_count"]),
    volumeUsd: readNumeric(d, ["volumeUsd", "volume_usd", "volume24h", "volume_24h", "volume", "vol", "tradingVolumeUsd", "trading_volume_usd", "tradeVolumeUsd", "trade_volume_usd"]),
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
  if (Date.now() < tokenListDisabledUntil) {
    return [];
  }

  const data = await birdeyeGet<unknown>("/v1/wallet/token_list", { wallet }).catch((err) => {
    if (err instanceof BirdeyeError && (err.status === 401 || err.status === 403 || err.status === 404)) {
      tokenListDisabledUntil = Date.now() + 60 * 60 * 1000;
      return null;
    }
    throw err;
  });

  if (!data) {
    return [];
  }

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
  if (Date.now() < firstFundedDisabledUntil) {
    return { wallet, firstFundedAt: null, walletAgeDays: null };
  }

  const data = await birdeyeGet<unknown>("/wallet/v2/tx/first-funded", {
    wallet,
  }).catch((err) => {
    if (err instanceof BirdeyeError && err.status === 404) {
      firstFundedDisabledUntil = Date.now() + 60 * 60 * 1000;
      return null;
    }
    throw err;
  });

  if (!data) {
    return { wallet, firstFundedAt: null, walletAgeDays: null };
  }

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
      pnlUsd: readNumeric(r, ["pnlUsd", "pnl_usd", "pnl", "profitUsd", "profit_usd", "profit"]),
      roiPercent: readNumeric(r, ["roiPercent", "roi_percent", "roi"]),
      winRate: readNumeric(r, ["winRate", "win_rate"]),
      tradeCount: readNumeric(r, ["tradeCount", "trade_count"]),
      volumeUsd: readNumeric(r, ["volumeUsd", "volume_usd", "volume24h", "volume_24h", "volume", "vol", "tradingVolumeUsd", "trading_volume_usd", "tradeVolumeUsd", "trade_volume_usd", "quoteVolume", "quote_volume"]),
    };
  });
}
