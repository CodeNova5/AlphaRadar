import { getWalletTokenList, getTokenMetadata, getTokenMarketData, getTokenSecurity } from "@/lib/birdeye/endpoints";
import type { TimeWindow } from "@/lib/birdeye/types";
import { computeTokenSignalScore } from "@/lib/scoring/tokenSignalScore";
import type { TokenSignalInput } from "@/lib/scoring/tokenSignalScore";
import { supabase } from "@/lib/supabase/client-server";
import { getLatestLeaderboard } from "./leaderboardService";

export interface TokenSignal {
  tokenAddress: string;
  symbol: string;
  name: string;
  logoUri: string;
  signalScore: number;
  signalLabel: string;
  smartWalletCount: number;
  combinedWalletPnl: number;
  averageAlphaScore: number;
  liquidityUsd: number;
  volume24h: number;
  securityStatus: string;
  explanation: string;
  participants: {
    wallet: string;
    walletAlphaScore: number;
    walletPnlUsd: number;
    holdingValueUsd: number;
    portfolioWeight: number;
  }[];
}

export interface SmartMoneyFeedResult {
  window: TimeWindow;
  generatedAt: string;
  signals: TokenSignal[];
  warnings: string[];
}

interface TokenAggregation {
  tokenAddress: string;
  wallets: {
    wallet: string;
    alphaScore: number;
    pnlUsd: number;
    holdingValueUsd: number;
    portfolioWeight: number;
  }[];
}

export async function buildSmartMoneyFeed(
  window: TimeWindow,
  limit: number = 30
): Promise<SmartMoneyFeedResult> {
  const warnings: string[] = [];

  // Step 1: Load top wallets from leaderboard
  const leaderboard = await getLatestLeaderboard(window, 50);
    // Relaxed filter: include wallets with alphaScore >= 40 and allow low confidence
    const topWallets = leaderboard.entries
      .filter((e) => e.alphaScore >= 40)
      .slice(0, 25);

  if (topWallets.length === 0) {
    return {
      window,
      generatedAt: new Date().toISOString(),
      signals: [],
      warnings: ["No qualifying smart wallets found in leaderboard"],
    };
  }

  // Step 2: Aggregate holdings by token
  const tokenMap = new Map<string, TokenAggregation>();

  for (const wallet of topWallets) {
    try {
      const holdings = await getWalletTokenList(wallet.wallet);
      for (const h of holdings) {
        if (h.valueUsd < 1) continue; // skip dust
        const existing = tokenMap.get(h.tokenAddress);
        const participant = {
          wallet: wallet.wallet,
          alphaScore: wallet.alphaScore,
          pnlUsd: wallet.pnlUsd,
          holdingValueUsd: h.valueUsd,
          portfolioWeight: h.portfolioWeight,
        };
        if (existing) {
          existing.wallets.push(participant);
        } else {
          tokenMap.set(h.tokenAddress, {
            tokenAddress: h.tokenAddress,
            wallets: [participant],
          });
        }
      }
    } catch (e) {
      warnings.push(`Holdings for ${wallet.wallet} unavailable: ${(e as Error).message}`);
    }
  }

  // Step 3: Filter to tokens with at least 2 smart wallets
  const qualifyingTokens = [...tokenMap.values()]
    .filter((t) => t.wallets.length >= 2)
    .sort((a, b) => b.wallets.length - a.wallets.length)
    .slice(0, limit * 2); // more than needed, some may fail enrichment

  // Step 4: Enrich and score each token
  const signals: TokenSignal[] = [];

  for (const token of qualifyingTokens) {
    try {
      // Fetch metadata
      let symbol = "", name = "", logoUri = "";
      try {
        const metas = await getTokenMetadata([token.tokenAddress]);
        if (metas.length > 0) {
          symbol = metas[0].symbol;
          name = metas[0].name;
          logoUri = metas[0].logoUri;
        }
      } catch {
        warnings.push(`Metadata unavailable for ${token.tokenAddress}`);
      }

      // Fetch market data
      let liquidityUsd = 0, volume24h = 0;
      try {
        const market = await getTokenMarketData(token.tokenAddress);
        liquidityUsd = market.liquidityUsd;
        volume24h = market.volume24h;
      } catch {
        warnings.push(`Market data unavailable for ${token.tokenAddress}`);
      }

      // Fetch security
      let securityPassed: boolean | null = null;
      let securityStatus = "unknown";
      try {
        const sec = await getTokenSecurity(token.tokenAddress);
        if (sec.isHoneypot !== null) {
          securityPassed = !sec.isHoneypot && (sec.buyTax ?? 0) < 0.1 && (sec.sellTax ?? 0) < 0.1;
          securityStatus = securityPassed ? "passed" : "flagged";
        }
      } catch {
        securityStatus = "unavailable";
      }

      // Compute signal score
      const avgAlpha = token.wallets.reduce((s, w) => s + w.alphaScore, 0) / token.wallets.length;
      const combinedPnl = token.wallets.reduce((s, w) => s + w.pnlUsd, 0);
      const avgPortfolioWeight = token.wallets.reduce((s, w) => s + w.portfolioWeight, 0) / token.wallets.length;

      const signalInput: TokenSignalInput = {
        smartWalletCount: token.wallets.length,
        averageAlphaScore: avgAlpha,
        combinedWalletPnl: combinedPnl,
        averagePortfolioWeight: avgPortfolioWeight,
        liquidityUsd,
        securityPassed,
        isFresh: true,
      };

      const signalResult = computeTokenSignalScore(signalInput);

      signals.push({
        tokenAddress: token.tokenAddress,
        symbol,
        name,
        logoUri,
        signalScore: signalResult.signalScore,
        signalLabel: signalResult.signalLabel,
        smartWalletCount: token.wallets.length,
        combinedWalletPnl: combinedPnl,
        averageAlphaScore: Math.round(avgAlpha),
        liquidityUsd,
        volume24h,
        securityStatus,
        explanation: signalResult.explanation,
        participants: token.wallets.map((w) => ({
          wallet: w.wallet,
          walletAlphaScore: w.alphaScore,
          walletPnlUsd: w.pnlUsd,
          holdingValueUsd: w.holdingValueUsd,
          portfolioWeight: w.portfolioWeight,
        })),
      });
    } catch (e) {
      warnings.push(`Failed to score token ${token.tokenAddress}: ${(e as Error).message}`);
    }
  }

  // Sort by signal score
  signals.sort((a, b) => b.signalScore - a.signalScore);

  const result: SmartMoneyFeedResult = {
    window,
    generatedAt: new Date().toISOString(),
    signals: signals.slice(0, limit),
    warnings,
  };

  // Save to DB
  await saveSmartMoneyFeedToDB(result);

  return result;
}

async function saveSmartMoneyFeedToDB(result: SmartMoneyFeedResult): Promise<void> {
  try {
    for (const signal of result.signals) {
      const { data: snap, error } = await supabase
        .from("token_signal_snapshots")
        .insert({
          token_address: signal.tokenAddress,
          signal_score: signal.signalScore,
          signal_label: signal.signalLabel,
          smart_wallet_count: signal.smartWalletCount,
          average_alpha_score: signal.averageAlphaScore,
          combined_wallet_pnl: signal.combinedWalletPnl,
          liquidity_usd: signal.liquidityUsd,
          volume_24h: signal.volume24h,
          security_status: signal.securityStatus,
          generated_at: result.generatedAt,
        })
        .select("id")
        .maybeSingle();

      if (error || !snap) continue;

      const participants = signal.participants.map((p) => ({
        signal_snapshot_id: (snap as { id: string }).id,
        wallet_address: p.wallet,
        wallet_alpha_score: p.walletAlphaScore,
        wallet_pnl_usd: p.walletPnlUsd,
        holding_value_usd: p.holdingValueUsd,
        portfolio_weight: p.portfolioWeight,
        reason: "holding",
      }));

      await supabase.from("token_signal_participants").insert(participants);
    }
  } catch (e) {
    console.error("Failed to save smart money feed:", e);
  }
}

export async function getLatestSmartMoneyFeed(
  window: TimeWindow,
  limit: number = 30
): Promise<SmartMoneyFeedResult> {
  try {
    const { data: snapshots, error } = await supabase
      .from("token_signal_snapshots")
      .select("id, token_address, signal_score, signal_label, smart_wallet_count, average_alpha_score, combined_wallet_pnl, liquidity_usd, volume_24h, security_status, generated_at")
      .order("generated_at", { ascending: false })
      .order("signal_score", { ascending: false })
      .limit(limit);

    if (error || !snapshots || snapshots.length === 0) {
      return buildSmartMoneyFeed(window, limit);
    }

    const generatedAt = (snapshots[0] as Record<string, unknown>).generated_at as string;
    const signals: TokenSignal[] = [];

    for (const snap of snapshots) {
      const s = snap as Record<string, unknown>;
      const { data: parts } = await supabase
        .from("token_signal_participants")
        .select("*")
        .eq("signal_snapshot_id", s.id);

      signals.push({
        tokenAddress: s.token_address as string,
        symbol: "",
        name: "",
        logoUri: "",
        signalScore: s.signal_score as number,
        signalLabel: s.signal_label as string,
        smartWalletCount: s.smart_wallet_count as number,
        combinedWalletPnl: s.combined_wallet_pnl as number,
        averageAlphaScore: s.average_alpha_score as number,
        liquidityUsd: s.liquidity_usd as number,
        volume24h: s.volume_24h as number,
        securityStatus: s.security_status as string,
        explanation: "",
        participants: (parts ?? []).map((p: Record<string, unknown>) => ({
          wallet: p.wallet_address as string,
          walletAlphaScore: p.wallet_alpha_score as number,
          walletPnlUsd: p.wallet_pnl_usd as number,
          holdingValueUsd: p.holding_value_usd as number,
          portfolioWeight: p.portfolio_weight as number,
        })),
      });
    }

    return { window, generatedAt, signals, warnings: [] };
  } catch {
    return buildSmartMoneyFeed(window, limit);
  }
}
