"use client";

import { useState, useEffect } from "react";
import { WalletSearchInput } from "@/components/shared/wallet-search-input";
import { WindowSelector } from "@/components/shared/window-selector";
import { ProfitableTradersCard } from "@/components/leaderboard/profitable-traders-card";
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { LoadingSpinner, ErrorState, EmptyState } from "@/components/shared/loading";
import { formatPercent, formatUsd } from "@/components/shared/format";

interface LeaderboardEntry {
  rank: number;
  wallet: string;
  pnlUsd: number;
  roiPercent: number;
  winRate: number;
  tradeCount: number;
  volumeUsd: number;
  alphaScore: number;
  alphaClass: string;
  confidence: string;
  walletAgeDays: number | null;
  archetype: string;
}

export default function LeaderboardPage() {
  const [window, setWindow] = useState("7d");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");

  const summary = entries.length > 0
    ? {
        topPnl: Math.max(...entries.map((entry) => entry.pnlUsd)),
        avgRoi: entries.reduce((sum, entry) => sum + entry.roiPercent, 0) / entries.length,
        avgWinRate: entries.reduce((sum, entry) => sum + entry.winRate, 0) / entries.length,
        avgVolume: entries.reduce((sum, entry) => sum + entry.volumeUsd, 0) / entries.length,
      }
    : null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`/api/leaderboard?window=${window}&limit=50`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error || "Failed to load leaderboard");
          return;
        }
        setEntries(json.data.entries ?? []);
        setGeneratedAt(json.data.generatedAt ?? "");
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [window]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          Solana Trader <span className="text-primary">Leaderboard</span>
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto mb-6">
          Which wallets are actually profitable? AlphaTrace ranks Solana traders by real PNL, consistency, and wallet credibility.
        </p>
        <div className="flex justify-center">
          <WalletSearchInput size="lg" />
        </div>
      </div>

      {!loading && !error && entries.length > 0 && (
        <div className="mb-8">
          <ProfitableTradersCard entries={entries} />
        </div>
      )}

      <div id="full-leaderboard" className="flex items-center justify-between mb-6 scroll-mt-24">
        <WindowSelector value={window} onChange={setWindow} />
        {generatedAt && (
          <p className="text-xs text-muted-foreground">
            Updated {new Date(generatedAt).toLocaleTimeString()}
          </p>
        )}
      </div>

      {!loading && !error && summary && (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-card-border bg-surface/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Top PnL</p>
            <p className="mt-2 text-xl font-semibold text-emerald-400">{formatUsd(summary.topPnl)}</p>
          </div>
          <div className="rounded-xl border border-card-border bg-surface/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Avg ROI</p>
            <p className={`mt-2 text-xl font-semibold ${summary.avgRoi >= 0 ? "text-primary" : "text-danger"}`}>
              {formatPercent(summary.avgRoi)}
            </p>
          </div>
          <div className="rounded-xl border border-card-border bg-surface/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Avg Win Rate</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{(summary.avgWinRate * 100).toFixed(0)}%</p>
          </div>
          <div className="rounded-xl border border-card-border bg-surface/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Avg 7D Vol</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{formatUsd(summary.avgVolume)}</p>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSpinner text="Loading leaderboard..." />
      ) : error ? (
        <ErrorState message={error} />
      ) : entries.length === 0 ? (
        <EmptyState message="No leaderboard data available yet. Try refreshing." />
      ) : (
        <LeaderboardTable entries={entries} />
      )}
    </div>
  );
}
