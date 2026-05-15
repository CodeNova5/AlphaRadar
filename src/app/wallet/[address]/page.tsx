"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { WalletSummaryCards } from "@/components/wallet/wallet-summary-cards";
import { AlphaScoreBreakdown } from "@/components/wallet/alpha-score-breakdown";
import { TokenPnlTable } from "@/components/wallet/token-pnl-table";
import { NetWorthChart } from "@/components/wallet/net-worth-chart";
import { HoldingsTable } from "@/components/wallet/holdings-table";
import { WindowSelector } from "@/components/shared/window-selector";
import { LoadingSpinner, ErrorState } from "@/components/shared/loading";

interface WalletProfile {
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
    confidence: string;
    confidenceReason: string;
  };
  archetype: { archetype: string; explanation: string };
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

export default function WalletProfilePage() {
  const params = useParams();
  const address = params.address as string;
  const [window, setWindow] = useState("7d");
  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`/api/wallets/${address}/profile?window=${window}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error || "Failed to load wallet profile");
          return;
        }
        setProfile(json.data);
        setWarnings(json.warnings ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [address, window]);

  if (loading) return <LoadingSpinner text="Analyzing wallet..." />;
  if (error) return <ErrorState message={error} />;
  if (!profile) return <ErrorState message="No profile data returned" />;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono">{profile.wallet}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Wallet Profile
            {warnings.length > 0 && (
              <span className="text-accent ml-2">({warnings.length} warnings)</span>
            )}
          </p>
        </div>
        <WindowSelector value={window} onChange={setWindow} />
      </div>

      {/* Summary Cards */}
      <WalletSummaryCards
        pnlUsd={profile.summary.pnlUsd}
        roiPercent={profile.summary.roiPercent}
        walletAgeDays={profile.walletAgeDays}
        tradeCount={profile.summary.tradeCount}
        winRate={profile.summary.winRate}
      />

      {/* Alpha Score */}
      <AlphaScoreBreakdown
        score={profile.alphaScore.score}
        alphaClass={profile.alphaScore.alphaClass}
        confidence={profile.alphaScore.confidence}
        confidenceReason={profile.alphaScore.confidenceReason}
        archetype={profile.archetype.archetype}
        archetypeExplanation={profile.archetype.explanation}
        riskFlags={profile.riskFlags}
      />

      {/* Net Worth Chart */}
      <NetWorthChart data={profile.netWorthSeries} />

      {/* Token PNL Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TokenPnlTable tokens={profile.topWinningTokens} title="Top Winning Tokens" />
        <TokenPnlTable tokens={profile.topLosingTokens} title="Top Losing Tokens" />
      </div>

      {/* Holdings */}
      <HoldingsTable holdings={profile.currentHoldings} />
    </div>
  );
}
