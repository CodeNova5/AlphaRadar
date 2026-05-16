import { getTraderGainersLosers, getWalletPnlSummary, getWalletFirstFunded } from "@/lib/birdeye/endpoints";
import type { TimeWindow, BirdeyeTraderRow } from "@/lib/birdeye/types";
import { computeAlphaScore } from "@/lib/scoring/walletAlphaScore";
import { classifyArchetype } from "@/lib/scoring/archetypes";
import type { ScoreInput } from "@/lib/scoring/walletAlphaScore";
import { supabase } from "@/lib/supabase/client-server";

export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  pnlUsd: number;
  roiPercent: number;
  winRate: number;
  alphaScore: number;
  alphaClass: string;
  confidence: "high" | "medium" | "low";
  walletAgeDays: number | null;
  archetype: string;
  tradeCount: number;
  volumeUsd: number;
}

export interface LeaderboardResult {
  window: TimeWindow;
  generatedAt: string;
  entries: LeaderboardEntry[];
  warnings: string[];
}

const leaderboardMemoryCache = new Map<string, { expiresAt: number; result: LeaderboardResult }>();
const leaderboardInFlight = new Map<string, Promise<LeaderboardResult>>();

export async function buildLeaderboard(
  window: TimeWindow,
  limit: number = 50
): Promise<LeaderboardResult> {
  const warnings: string[] = [];

  // Step 1: Get candidate wallets from gainers-losers
  let candidates: BirdeyeTraderRow[];
  try {
    candidates = await getTraderGainersLosers(window);
  } catch (e) {
    const cached = await loadLatestLeaderboardFromDB(window);
    if (cached) {
      return { ...cached, warnings: [...warnings, `Birdeye unavailable, using cached data: ${(e as Error).message}`] };
    }
    throw e;
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    if (seen.has(c.wallet)) return false;
    seen.add(c.wallet);
    return true;
  });

  // Step 2: Enrich each wallet with PNL summary (for winRate, roiPercent, tradeCount)
  const entries: LeaderboardEntry[] = [];
  const toProcess = unique.slice(0, Math.min(limit * 2, 100));

  for (const candidate of toProcess) {
    try {
      // Try to get PNL summary for accurate winRate, roi, tradeCount
      let pnlSummary = null;
      let firstFunded = null;

      try {
        pnlSummary = await getWalletPnlSummary(candidate.wallet, window);
      } catch {
        // PNL summary unavailable, use candidate data
      }

      try {
        firstFunded = await getWalletFirstFunded(candidate.wallet);
      } catch {
        // Non-critical
      }

      const pnlUsd = pnlSummary?.totalPnlUsd ?? candidate.pnlUsd;
      const roiPercent = pnlSummary?.roiPercent ?? 0;
      const winRate = pnlSummary?.winRate ?? 0;
      const tradeCount = pnlSummary?.tradeCount ?? candidate.tradeCount;
      const volumeUsd = pnlSummary?.volumeUsd ?? candidate.volumeUsd;
      const walletAgeDays = firstFunded?.walletAgeDays ?? null;

      const pnlConcentration = 0.5;
      const scoreInput: ScoreInput = {
        realizedPnlUsd: pnlSummary?.realizedPnlUsd ?? candidate.pnlUsd,
        roiPercent,
        winRate,
        tradeCount,
        tokenCount: 5,
        walletAgeDays: walletAgeDays ?? 0,
        volumeUsd,
        recentActivity: true,
        pnlConcentration,
      };

      const scoreResult = computeAlphaScore(scoreInput);
      const archetypeResult = classifyArchetype({
        alphaScore: scoreResult.alphaScore,
        roiPercent,
        winRate,
        pnlConcentration,
        recentActivity: true,
        realizedPnlUsd: pnlSummary?.realizedPnlUsd ?? candidate.pnlUsd,
        tradeCount,
        walletAgeDays: walletAgeDays ?? 0,
      });

      entries.push({
        rank: 0,
        wallet: candidate.wallet,
        pnlUsd,
        roiPercent,
        winRate,
        alphaScore: scoreResult.alphaScore,
        alphaClass: scoreResult.alphaClass,
        confidence: scoreResult.confidence,
        walletAgeDays,
        archetype: archetypeResult.archetype,
        tradeCount,
        volumeUsd,
      });
    } catch (e) {
      warnings.push(`Failed to score wallet ${candidate.wallet}: ${(e as Error).message}`);
    }
  }

  // Sort by alpha score
  entries.sort((a, b) => b.alphaScore - a.alphaScore);
  entries.forEach((e, i) => (e.rank = i + 1));

  const result: LeaderboardResult = {
    window,
    generatedAt: new Date().toISOString(),
    entries: entries.slice(0, limit),
    warnings,
  };

  await saveLeaderboardToDB(result);

  leaderboardMemoryCache.set(cacheKey(window, limit), {
    expiresAt: Date.now() + 15 * 60 * 1000,
    result,
  });

  return result;
}

function cacheKey(window: TimeWindow, limit: number): string {
  return `${window}:${limit}`;
}

async function saveLeaderboardToDB(result: LeaderboardResult): Promise<void> {
  try {
    const { data: snapshot, error: snapErr } = await supabase
      .from("leaderboard_snapshots")
      .insert({
        time_window: result.window,
        generated_at: result.generatedAt,
        wallet_count: result.entries.length,
      })
      .select("id")
      .maybeSingle();

    if (snapErr || !snapshot) {
      console.error("Failed to save leaderboard snapshot:", snapErr);
      return;
    }

    const rows = result.entries.map((e) => ({
      snapshot_id: (snapshot as { id: string }).id,
      wallet_address: e.wallet,
      rank: e.rank,
      pnl_usd: e.pnlUsd,
      roi_percent: e.roiPercent,
      alpha_score: e.alphaScore,
      confidence: e.confidence,
      archetype: e.archetype,
      wallet_age_days: e.walletAgeDays,
      win_rate: e.winRate,
      trade_count: e.tradeCount,
      volume_usd: e.volumeUsd,
    }));

    const { error: entryErr } = await supabase
      .from("leaderboard_entries")
      .insert(rows);

    if (entryErr) {
      console.error("Failed to save leaderboard entries:", entryErr);
    }
  } catch (e) {
    console.error("Failed to save leaderboard to DB:", e);
  }
}

async function loadLatestLeaderboardFromDB(
  window: TimeWindow
): Promise<LeaderboardResult | null> {
  try {
    const { data: snapshot, error } = await supabase
      .from("leaderboard_snapshots")
      .select("id, generated_at, wallet_count")
      .eq("time_window", window)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !snapshot) return null;

    const { data: entries, error: entryErr } = await supabase
      .from("leaderboard_entries")
      .select("*")
      .eq("snapshot_id", (snapshot as { id: string }).id)
      .order("rank", { ascending: true });

    if (entryErr || !entries || entries.length === 0) return null;

    return {
      window,
      generatedAt: (snapshot as { generated_at: string }).generated_at,
      entries: entries.map((e: Record<string, unknown>) => ({
        rank: e.rank as number,
        wallet: e.wallet_address as string,
        pnlUsd: e.pnl_usd as number,
        roiPercent: e.roi_percent as number,
        winRate: e.win_rate as number,
        alphaScore: e.alpha_score as number,
        alphaClass: (e.alpha_class as string) || "Moderate",
        confidence: (e.confidence as "high" | "medium" | "low") || "medium",
        walletAgeDays: e.wallet_age_days as number | null,
        archetype: e.archetype as string,
        tradeCount: e.trade_count as number,
        volumeUsd: e.volume_usd as number,
      })),
      warnings: [],
    };
  } catch {
    return null;
  }
}

export async function getLatestLeaderboard(
  window: TimeWindow,
  limit: number = 50
): Promise<LeaderboardResult> {
  const key = cacheKey(window, limit);

  const cachedMemory = leaderboardMemoryCache.get(key);
  if (cachedMemory && cachedMemory.expiresAt > Date.now()) {
    return cachedMemory.result;
  }

  const inFlight = leaderboardInFlight.get(key);
  if (inFlight) {
    return inFlight;
  }

  // Try DB cache first
  const cachedDB = await loadLatestLeaderboardFromDB(window);
  if (cachedDB) {
    const result = { ...cachedDB, entries: cachedDB.entries.slice(0, limit) };
    leaderboardMemoryCache.set(key, { expiresAt: Date.now() + 15 * 60 * 1000, result });
    return result;
  }

  const requestPromise = buildLeaderboard(window, limit).finally(() => {
    leaderboardInFlight.delete(key);
  });

  leaderboardInFlight.set(key, requestPromise);
  return requestPromise;
}
