"use client";

import { useState, useEffect } from "react";
import { WalletSearchInput } from "@/components/shared/wallet-search-input";
import { WindowSelector } from "@/components/shared/window-selector";
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { LoadingSpinner, ErrorState, EmptyState } from "@/components/shared/loading";

interface LeaderboardEntry {
  rank: number;
  wallet: string;
  pnlUsd: number;
  roiPercent: number;
  winRate: number;
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

      <div className="flex items-center justify-between mb-6">
        <WindowSelector value={window} onChange={setWindow} />
        {generatedAt && (
          <p className="text-xs text-muted-foreground">
            Updated {new Date(generatedAt).toLocaleTimeString()}
          </p>
        )}
      </div>

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
