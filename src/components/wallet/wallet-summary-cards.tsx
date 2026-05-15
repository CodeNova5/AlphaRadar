import { formatUsd, formatPercent } from "@/components/shared/format";

interface SummaryCardsProps {
  pnlUsd: number;
  roiPercent: number;
  walletAgeDays: number | null;
  tradeCount: number;
  winRate: number;
}

export function WalletSummaryCards({ pnlUsd, roiPercent, walletAgeDays, tradeCount, winRate }: SummaryCardsProps) {
  const cards = [
    {
      label: "Total PNL",
      value: formatUsd(pnlUsd),
      color: pnlUsd >= 0 ? "text-primary" : "text-danger",
    },
    {
      label: "ROI",
      value: formatPercent(roiPercent),
      color: roiPercent >= 0 ? "text-primary" : "text-danger",
    },
    {
      label: "Win Rate",
      value: `${(winRate * 100).toFixed(0)}%`,
      color: winRate >= 0.5 ? "text-primary" : "text-accent",
    },
    {
      label: "Trades",
      value: tradeCount.toLocaleString(),
      color: "text-foreground",
    },
    {
      label: "Wallet Age",
      value: walletAgeDays !== null ? `${walletAgeDays} days` : "N/A",
      color: "text-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-card-border bg-card p-4"
        >
          <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
          <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
