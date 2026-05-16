import {
  getWalletPnlSummary,
  getWalletPnlDetails,
  getWalletNetWorth,
  getWalletTokenList,
  getWalletFirstFunded,
  getTokenMetadata,
} from "@/lib/birdeye/endpoints";
import type { TimeWindow } from "@/lib/birdeye/types";
import { computeAlphaScore } from "@/lib/scoring/walletAlphaScore";
import { classifyArchetype } from "@/lib/scoring/archetypes";
import type { ScoreInput } from "@/lib/scoring/walletAlphaScore";
import { BirdeyeError } from "@/lib/birdeye/client";

export interface WalletProfile {
  wallet: string;
  summary: {
    pnlUsd: number;
    roiPercent: number;
    winRate: number;
    tradeCount: number;
    volumeUsd: number;
    realizedPnlUsd: number;
    unrealizedPnlUsd: number;
  };
  alphaScore: {
    score: number;
    alphaClass: string;
    confidence: "high" | "medium" | "low";
    confidenceReason: string;
    breakdown: ScoreInput;
  };
  archetype: {
    archetype: string;
    explanation: string;
  };
  netWorthSeries: { timestamp: number; valueUsd: number }[];
  topWinningTokens: {
    tokenAddress: string;
    symbol: string;
    name: string;
    logoUri: string;
    realizedPnlUsd: number;
    roiPercent: number;
  }[];
  topLosingTokens: {
    tokenAddress: string;
    symbol: string;
    name: string;
    logoUri: string;
    realizedPnlUsd: number;
    roiPercent: number;
  }[];
  currentHoldings: {
    tokenAddress: string;
    symbol: string;
    name: string;
    logoUri: string;
    balance: number;
    valueUsd: number;
    portfolioWeight: number;
  }[];
  walletAgeDays: number | null;
  riskFlags: string[];
}

export async function buildWalletProfile(
  wallet: string,
  window: TimeWindow
): Promise<{ profile: WalletProfile; warnings: string[] }> {
  const warnings: string[] = [];

  const [
    pnlSummaryResult,
    pnlDetailsResult,
    netWorthResult,
    holdingsResult,
    firstFundedResult,
  ] = await Promise.allSettled([
    getWalletPnlSummary(wallet, window),
    getWalletPnlDetails(wallet, window),
    getWalletNetWorth(wallet, window),
    getWalletTokenList(wallet),
    getWalletFirstFunded(wallet),
  ]);

  const pnlSummary =
    pnlSummaryResult.status === "fulfilled" ? pnlSummaryResult.value : undefined;
  if (pnlSummaryResult.status === "rejected") {
    warnings.push(`PNL summary unavailable: ${(pnlSummaryResult.reason as Error).message}`);
  }

  const pnlDetails =
    pnlDetailsResult.status === "fulfilled" ? pnlDetailsResult.value : undefined;
  if (pnlDetailsResult.status === "rejected") {
    warnings.push(`PNL details unavailable: ${(pnlDetailsResult.reason as Error).message}`);
  }

  const netWorth =
    netWorthResult.status === "fulfilled" ? netWorthResult.value : undefined;
  if (netWorthResult.status === "rejected") {
    warnings.push(`Net worth history unavailable: ${(netWorthResult.reason as Error).message}`);
  }

  const holdings =
    holdingsResult.status === "fulfilled" ? holdingsResult.value : undefined;
  if (holdingsResult.status === "rejected") {
    warnings.push(`Current holdings unavailable: ${(holdingsResult.reason as Error).message}`);
  }

  const firstFunded =
    firstFundedResult.status === "fulfilled" ? firstFundedResult.value : undefined;
  if (firstFundedResult.status === "rejected") {
    warnings.push(`First-funded data unavailable: ${(firstFundedResult.reason as Error).message}`);
  }

  // Enrich token metadata for PNL details
  let enrichedPnlDetails = pnlDetails ?? [];
  if (enrichedPnlDetails.length > 0) {
    const missingMeta = enrichedPnlDetails.filter((t) => !t.symbol);
    if (missingMeta.length > 0) {
      try {
        const metas = await getTokenMetadata(missingMeta.map((t) => t.tokenAddress));
        const metaMap = new Map(metas.map((m) => [m.address, m]));
        enrichedPnlDetails = enrichedPnlDetails.map((t) => {
          const meta = metaMap.get(t.tokenAddress);
          if (meta) {
            return { ...t, symbol: meta.symbol || t.symbol, name: meta.name || t.name, logoUri: meta.logoUri || t.logoUri };
          }
          return t;
        });
      } catch {
        warnings.push("Token metadata enrichment failed for some tokens");
      }
    }
  }

  // Compute PNL concentration
  const totalPnl = enrichedPnlDetails.reduce((s, t) => s + Math.abs(t.realizedPnlUsd), 0);
  const topTokenPnl = enrichedPnlDetails.length > 0
    ? Math.max(...enrichedPnlDetails.map((t) => Math.abs(t.realizedPnlUsd)))
    : 0;
  const pnlConcentration = totalPnl > 0 ? topTokenPnl / totalPnl : 0;

  const summary = pnlSummary
    ? {
        pnlUsd: pnlSummary.totalPnlUsd,
        roiPercent: pnlSummary.roiPercent,
        winRate: pnlSummary.winRate,
        tradeCount: pnlSummary.tradeCount,
        volumeUsd: pnlSummary.volumeUsd,
        realizedPnlUsd: pnlSummary.realizedPnlUsd,
        unrealizedPnlUsd: pnlSummary.unrealizedPnlUsd,
      }
    : { pnlUsd: 0, roiPercent: 0, winRate: 0, tradeCount: 0, volumeUsd: 0, realizedPnlUsd: 0, unrealizedPnlUsd: 0 };

  const scoreInput: ScoreInput = {
    realizedPnlUsd: summary.realizedPnlUsd,
    roiPercent: summary.roiPercent,
    winRate: summary.winRate,
    tradeCount: summary.tradeCount,
    tokenCount: enrichedPnlDetails.length,
    walletAgeDays: firstFunded?.walletAgeDays ?? 0,
    volumeUsd: summary.volumeUsd,
    recentActivity: enrichedPnlDetails.length > 0,
    pnlConcentration,
  };

  const scoreResult = computeAlphaScore(scoreInput);

  const archetypeResult = classifyArchetype({
    alphaScore: scoreResult.alphaScore,
    roiPercent: summary.roiPercent,
    winRate: summary.winRate,
    pnlConcentration,
    recentActivity: enrichedPnlDetails.length > 0,
    realizedPnlUsd: summary.realizedPnlUsd,
    tradeCount: summary.tradeCount,
    walletAgeDays: firstFunded?.walletAgeDays ?? 0,
  });

  // Sort PNL details
  const sortedByPnl = [...enrichedPnlDetails].sort(
    (a, b) => b.realizedPnlUsd - a.realizedPnlUsd
  );
  const topWinning = sortedByPnl.filter((t) => t.realizedPnlUsd > 0).slice(0, 5);
  const topLosing = sortedByPnl
    .filter((t) => t.realizedPnlUsd < 0)
    .reverse()
    .slice(0, 5);

  const profile: WalletProfile = {
    wallet,
    summary,
    alphaScore: {
      score: scoreResult.alphaScore,
      alphaClass: scoreResult.alphaClass,
      confidence: scoreResult.confidence,
      confidenceReason: scoreResult.confidenceReason,
      breakdown: scoreInput,
    },
    archetype: archetypeResult,
    netWorthSeries: netWorth ?? [],
    topWinningTokens: topWinning.map((t) => ({
      tokenAddress: t.tokenAddress,
      symbol: t.symbol,
      name: t.name,
      logoUri: t.logoUri,
      realizedPnlUsd: t.realizedPnlUsd,
      roiPercent: t.roiPercent,
    })),
    topLosingTokens: topLosing.map((t) => ({
      tokenAddress: t.tokenAddress,
      symbol: t.symbol,
      name: t.name,
      logoUri: t.logoUri,
      realizedPnlUsd: t.realizedPnlUsd,
      roiPercent: t.roiPercent,
    })),
    currentHoldings: (holdings ?? []).map((h) => ({
      tokenAddress: h.tokenAddress,
      symbol: h.symbol,
      name: h.name,
      logoUri: h.logoUri,
      balance: h.balance,
      valueUsd: h.valueUsd,
      portfolioWeight: h.portfolioWeight,
    })),
    walletAgeDays: firstFunded?.walletAgeDays ?? null,
    riskFlags: scoreResult.riskFlags,
  };

  return { profile, warnings };
}
