import { AlphaScoreBadge } from "@/components/shared/alpha-score-badge";
import { formatUsd } from "@/components/shared/format";

interface TokenSignalCardProps {
  signal: {
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
  };
  onShowParticipants: (participants: TokenSignalCardProps["signal"]["participants"]) => void;
}

export function TokenSignalCard({ signal, onShowParticipants }: TokenSignalCardProps) {
  const securityColor =
    signal.securityStatus === "passed"
      ? "text-primary"
      : signal.securityStatus === "flagged"
        ? "text-danger"
        : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-card-border bg-card p-5 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {signal.logoUri && (
            <img src={signal.logoUri} alt="" className="h-8 w-8 rounded-full" />
          )}
          <div>
            <h3 className="font-semibold text-foreground">
              {signal.symbol || signal.tokenAddress.slice(0, 8)}
            </h3>
            {signal.name && (
              <p className="text-xs text-muted-foreground">{signal.name}</p>
            )}
          </div>
        </div>
        <AlphaScoreBadge score={signal.signalScore} size="md" />
      </div>

      <p className="text-xs font-medium text-muted-foreground mb-3">{signal.signalLabel}</p>

      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div>
          <p className="text-xs text-muted-foreground">Smart Wallets</p>
          <p className="font-semibold">{signal.smartWalletCount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Avg Alpha Score</p>
          <p className="font-semibold">{signal.averageAlphaScore}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Combined PNL</p>
          <p className="font-semibold text-primary">{formatUsd(signal.combinedWalletPnl)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Security</p>
          <p className={`font-semibold capitalize ${securityColor}`}>{signal.securityStatus}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed mb-4">
        {signal.explanation}
      </p>

      <button
        onClick={() => onShowParticipants(signal.participants)}
        className="text-xs text-primary hover:underline"
      >
        View {signal.participants.length} participating wallets
      </button>
    </div>
  );
}
