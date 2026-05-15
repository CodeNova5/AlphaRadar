"use client";

import { useState, useEffect } from "react";
import { WindowSelector } from "@/components/shared/window-selector";
import { TokenSignalCard } from "@/components/smart-money/token-signal-card";
import { ParticipantsModal } from "@/components/smart-money/participants-modal";
import { LoadingSpinner, ErrorState, EmptyState } from "@/components/shared/loading";

interface TokenSignal {
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

export default function SmartMoneyPage() {
  const [window, setWindow] = useState("7d");
  const [signals, setSignals] = useState<TokenSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const [activeParticipants, setActiveParticipants] = useState<TokenSignal["participants"] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`/api/smart-money/feed?window=${window}&limit=30`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error || "Failed to load smart money feed");
          return;
        }
        setSignals(json.data.signals ?? []);
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
          Smart Money <span className="text-primary">Feed</span>
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Tokens with attention from profitable wallets. Every signal is backed by auditable wallet data.
        </p>
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
        <LoadingSpinner text="Loading smart money signals..." />
      ) : error ? (
        <ErrorState message={error} />
      ) : signals.length === 0 ? (
        <EmptyState message="No smart money signals available yet." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {signals.map((signal, i) => (
            <div
              key={signal.tokenAddress}
              className="animate-fade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <TokenSignalCard
                signal={signal}
                onShowParticipants={setActiveParticipants}
              />
            </div>
          ))}
        </div>
      )}

      {activeParticipants && (
        <ParticipantsModal
          participants={activeParticipants}
          onClose={() => setActiveParticipants(null)}
        />
      )}
    </div>
  );
}
