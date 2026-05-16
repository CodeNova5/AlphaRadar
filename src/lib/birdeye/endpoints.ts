import { birdeyeGet, birdeyePost, BirdeyeError } from "./client";
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

type TraderTimeWindow = "today" | "yesterday" | "1W";

let firstFundedDisabledUntil = 0;
let tokenListDisabledUntil = 0;
let tokenSecurityDisabledUntil = 0;
let tokenMetadataDisabledUntil = 0;

function toTraderTimeWindow(window: TimeWindow): TraderTimeWindow {
  switch (window) {
    case "24h": return "today";
    case "7d": return "1W";
    case "30d": return "1W";
    default: return "today";
  }
}

function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// ─── PNL Summary ───────────────────────────────────────────────────
// Actual Birdeye response (after client unwraps json.data):
// { summary: { counts: { total_buy, total_sell, total_trade, total_win, total_loss, win_rate },
//               cashflow_usd: { total_invested, total_sold, current_value },
//               pnl: { realized_profit_usd, realized_profit_percent, unrealized_usd, total_usd, avg_profit_per_trade_usd },
//               unique_tokens } }
// NOTE: summary.pnl does NOT include total_percent; use realized_profit_percent instead

export async function getWalletPnlSummary(
  wallet: string,
  window: TimeWindow
): Promise<BirdeyePnlSummary> {
  const data = await birdeyeGet<unknown>("/wallet/v2/pnl/summary", {
    wallet,
    duration: window,
  });

  const root = (data as Record<string, unknown>) ?? {};
  const summary = (root.summary as Record<string, unknown>) ?? root;
  const counts = (summary.counts as Record<string, unknown>) ?? {};
  const cashflow = (summary.cashflow_usd as Record<string, unknown>) ?? {};
  const pnl = (summary.pnl as Record<string, unknown>) ?? {};
  const realizedPnlUsd = num(pnl.realized_profit_usd);
  const unrealizedPnlUsd = num(pnl.unrealized_usd);
  const totalPnlUsd = num(pnl.total_usd) || realizedPnlUsd + unrealizedPnlUsd;
  const investedUsd = num(cashflow.total_invested) + num(cashflow.total_sold);
  const realizedRoiPercent = num(pnl.realized_profit_percent) * 100;
  const derivedRoiPercent = investedUsd > 0 ? (totalPnlUsd / investedUsd) * 100 : 0;

  // Compute win rate: prefer win_rate field, fall back to total_win/total_loss
  let winRate = num(counts.win_rate);
  const totalWin = num(counts.total_win);
  const totalLoss = num(counts.total_loss);
  const totalDecided = totalWin + totalLoss;
  if (winRate === 0) {
    if (totalDecided > 0) {
      winRate = totalWin / totalDecided;
    }
  }
  const derivedWinRate = totalDecided > 0 ? totalWin / totalDecided : 0;
  const finalWinRate = winRate || derivedWinRate;

  return {
    wallet,
    totalPnlUsd,
    totalPnlPercent: num(pnl.realized_profit_percent) * 100,
    realizedPnlUsd,
    unrealizedPnlUsd,
    roiPercent: realizedRoiPercent || derivedRoiPercent,
    winRate: finalWinRate,
    tradeCount: num(counts.total_trade),
    volumeUsd: investedUsd,
  };
}

// ─── PNL Details ───────────────────────────────────────────────────
// Actual Birdeye response (after client unwraps json.data):
// { meta: {...}, tokens: [ { address, symbol, decimals, last_trade_unix_time,
//   counts: { total_buy, total_sell, total_trade },
//   cashflow_usd: { total_invested, total_sold, current_value },
//   pnl: { realized_profit_usd, realized_profit_percent, unrealized_usd, total_usd, total_percent },
//   pricing: { current_price, avg_buy_cost, avg_sell_cost } } ] }

export async function getWalletPnlDetails(
  wallet: string,
  window: TimeWindow
): Promise<BirdeyeTokenPnl[]> {
  const data = await birdeyePost<unknown>("/wallet/v2/pnl/details", {
    wallet,
    duration: window,
    sort_type: "desc",
    sort_by: "last_trade",
    limit: 100,
    offset: 0,
  });

  const root = (data as Record<string, unknown>) ?? {};
  const tokens = Array.isArray(root.tokens) ? root.tokens : [];

  return tokens.map((raw: unknown) => {
    const t = raw as Record<string, unknown>;
    const counts = (t.counts as Record<string, unknown>) ?? {};
    const cashflow = (t.cashflow_usd as Record<string, unknown>) ?? {};
    const pnl = (t.pnl as Record<string, unknown>) ?? {};

    return {
      tokenAddress: str(t.address),
      symbol: str(t.symbol),
      name: str(t.name),
      logoUri: str(t.logoURI),
      realizedPnlUsd: num(pnl.realized_profit_usd),
      unrealizedPnlUsd: num(pnl.unrealized_usd),
      roiPercent: num(pnl.total_percent) * 100,
      buyCount: num(counts.total_buy),
      sellCount: num(counts.total_sell),
      volumeUsd: num(cashflow.total_invested) + num(cashflow.total_sold),
      lastActivityAt: t.last_trade_unix_time ? new Date(num(t.last_trade_unix_time) * 1000).toISOString() : null,
    };
  });
}

// ─── Net Worth ─────────────────────────────────────────────────────
// Actual Birdeye response:
// { wallet_address, currency, current_timestamp, past_timestamp,
//   history: [ { timestamp, net_worth, net_worth_change, net_worth_change_percent } ] }

export async function getWalletNetWorth(
  wallet: string,
  window: TimeWindow
): Promise<BirdeyeNetWorthPoint[]> {
  const data = await birdeyeGet<unknown>("/wallet/v2/net-worth", {
    wallet,
    count: window === "24h" ? "24" : window === "7d" ? "7" : "30",
    direction: "back",
    type: window === "24h" ? "1h" : "1d",
    sort_type: "desc",
  });

  const root = (data as Record<string, unknown>) ?? {};
  const history = Array.isArray(root.history) ? root.history : [];

  return history.map((raw: unknown) => {
    const h = raw as Record<string, unknown>;
    return {
      timestamp: new Date(str(h.timestamp)).getTime(),
      valueUsd: num(h.net_worth),
    };
  });
}

// ─── Token List ─────────────────────────────────────────────────────
// May be permission-restricted. Returns items array.
// Actual: { items: [ { address, symbol, name, logoURI, uiAmount, valueUsd, portfolioWeight } ] }

export async function getWalletTokenList(
  wallet: string
): Promise<BirdeyeHolding[]> {
  if (Date.now() < tokenListDisabledUntil) {
    return [];
  }

  try {
    const data = await birdeyeGet<unknown>("/v1/wallet/token_list", { wallet });
    const root = (data as Record<string, unknown>) ?? {};
    const items = Array.isArray(root.items) ? root.items : Array.isArray(root.tokens) ? root.tokens : Array.isArray(data) ? data : [];

    return items.map((raw: unknown) => {
      const t = raw as Record<string, unknown>;
      return {
        tokenAddress: str(t.address ?? t.mint),
        symbol: str(t.symbol),
        name: str(t.name),
        logoUri: str(t.logoURI),
        balance: num(t.uiAmount ?? t.amount ?? t.balance),
        valueUsd: num(t.valueUsd ?? t.usdValue),
        portfolioWeight: num(t.portfolioWeight ?? t.percent),
      };
    });
  } catch (e) {
    if (e instanceof BirdeyeError && (e.status === 403 || e.status === 401)) {
      tokenListDisabledUntil = Date.now() + 30 * 60 * 1000;
    }
    throw e;
  }
}

// ─── First Funded ──────────────────────────────────────────────────
// May return 404. Response: { <wallet>: { block_unix_time } }

export async function getWalletFirstFunded(
  wallet: string
): Promise<BirdeyeFirstFunded> {
  if (Date.now() < firstFundedDisabledUntil) {
    return { wallet, firstFundedAt: null, walletAgeDays: null };
  }

  try {
    const data = await birdeyeGet<unknown>("/wallet/v2/tx/first-funded", {
      wallet,
    });

    const root = (data as Record<string, unknown>) ?? {};
    const walletData = (root[wallet] as Record<string, unknown>) ?? root;
    const blockTime = num(walletData.block_unix_time);

    if (blockTime > 0) {
      const firstFundedAt = new Date(blockTime * 1000).toISOString();
      const walletAgeDays = Math.max(0, Math.floor((Date.now() - blockTime * 1000) / (1000 * 60 * 60 * 24)));
      return { wallet, firstFundedAt, walletAgeDays };
    }

    return { wallet, firstFundedAt: null, walletAgeDays: null };
  } catch (e) {
    if (e instanceof BirdeyeError && (e.status === 404 || e.status === 403 || e.status === 401)) {
      firstFundedDisabledUntil = Date.now() + 60 * 60 * 1000;
      return { wallet, firstFundedAt: null, walletAgeDays: null };
    }
    throw e;
  }
}

// ─── Token Metadata ────────────────────────────────────────────────
// May be permission-restricted. Returns map keyed by address.

export async function getTokenMetadata(
  tokenAddresses: string[]
): Promise<BirdeyeTokenMetadata[]> {
  if (tokenAddresses.length === 0) return [];
  if (Date.now() < tokenMetadataDisabledUntil) return [];

  try {
    const data = await birdeyeGet<unknown>("/defi/v3/token/meta-data/multiple", {
      list_token: tokenAddresses.join(","),
    });

    // Response can be a map keyed by address, or an array
    const items: unknown[] = Array.isArray(data)
      ? data
      : Object.values(data as Record<string, unknown>);

    return items.map((raw: unknown) => {
      const t = raw as Record<string, unknown>;
      return {
        address: str(t.address ?? t.mint),
        symbol: str(t.symbol),
        name: str(t.name),
        logoUri: str(t.logoURI),
        decimals: num(t.decimals),
        chain: str(t.chain) || "solana",
      };
    });
  } catch (e) {
    if (e instanceof BirdeyeError && (e.status === 403 || e.status === 401)) {
      tokenMetadataDisabledUntil = Date.now() + 60 * 60 * 1000;
      return [];
    }
    throw e;
  }
}

// ─── Token Market Data ─────────────────────────────────────────────
// Actual: { address, price, liquidity, total_supply, circulating_supply,
//           market_cap, fdv, holder, is_scaled_ui_token }

export async function getTokenMarketData(
  token: string
): Promise<BirdeyeTokenMarketData> {
  const data = await birdeyeGet<unknown>("/defi/v3/token/market-data", {
    address: token,
  });

  const r = (Array.isArray(data) ? (data as unknown[])[0] : data) as Record<string, unknown>;

  return {
    address: str(r.address) || token,
    symbol: str(r.symbol),
    price: num(r.price),
    liquidityUsd: num(r.liquidity),
    volume24h: num(r.volume_24h ?? r.volume24h),
    marketCap: num(r.market_cap ?? r.marketCap),
  };
}

// ─── Token Security ────────────────────────────────────────────────
// May be permission-restricted. Actual response:
// { ownerAddress, mutableMetadata, renounced, freezeAuthority, freezeable,
//   isToken2022, transferFeeEnable, transferFeeData, nonTransferable }

export async function getTokenSecurity(
  token: string
): Promise<BirdeyeTokenSecurity> {
  if (Date.now() < tokenSecurityDisabledUntil) {
    return { address: token, isHoneypot: null, buyTax: null, sellTax: null, isMintable: null, isFreezable: null, topHolderPercent: null };
  }

  try {
    const data = await birdeyeGet<unknown>("/defi/token_security", {
      address: token,
    });

    const r = (data as Record<string, unknown>) ?? {};

    return {
      address: token,
      isHoneypot: null,
      buyTax: r.transferFeeEnable === true ? num((r.transferFeeData as Record<string, unknown>)?.fee) : null,
      sellTax: r.transferFeeEnable === true ? num((r.transferFeeData as Record<string, unknown>)?.fee) : null,
      isMintable: r.ownerAddress !== null && r.ownerAddress !== undefined && str(r.ownerAddress) !== "",
      isFreezable: r.freezeable === true,
      topHolderPercent: null,
    };
  } catch (e) {
    if (e instanceof BirdeyeError && (e.status === 403 || e.status === 401)) {
      tokenSecurityDisabledUntil = Date.now() + 60 * 60 * 1000;
      return { address: token, isHoneypot: null, buyTax: null, sellTax: null, isMintable: null, isFreezable: null, topHolderPercent: null };
    }
    throw e;
  }
}

// ─── Trader Gainers-Losers ─────────────────────────────────────────
// Actual: { items: [ { network, address, pnl, volume, trade_count } ] }
// NOTE: No roi or winRate in the response - we compute from PNL details later

export async function getTraderGainersLosers(
  window: TimeWindow
): Promise<BirdeyeTraderRow[]> {
  const data = await birdeyeGet<unknown>("/trader/gainers-losers", {
    time_window: toTraderTimeWindow(window),
    limit: "100",
  });

  const root = (data as Record<string, unknown>) ?? {};
  const items = Array.isArray(root.items) ? root.items : Array.isArray(root.traders) ? root.traders : Array.isArray(data) ? data : [];

  return items.map((raw: unknown) => {
    const t = raw as Record<string, unknown>;
    return {
      wallet: str(t.address ?? t.wallet ?? t.owner),
      pnlUsd: num(t.pnl ?? t.pnl_usd),
      roiPercent: 0, // not provided by this endpoint
      winRate: 0,     // not provided by this endpoint
      tradeCount: num(t.trade_count ?? t.tradeCount),
      volumeUsd: num(t.volume ?? t.volume_usd),
    };
  });
}
