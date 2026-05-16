import Link from "next/link";
import { formatUsd, formatPercent, shortenAddress } from "@/components/shared/format";

interface Entry {
  rank: number;
  wallet: string;
  pnlUsd: number;
  roiPercent: number;
  winRate: number;
  volumeUsd: number;
}

function TraderMark({ wallet, rank }: { wallet: string; rank: number }) {
  const label = wallet.slice(0, 2).toUpperCase();
  const palette = [
    "from-cyan-400 to-blue-500",
    "from-emerald-400 to-teal-500",
    "from-amber-400 to-orange-500",
    "from-violet-400 to-fuchsia-500",
  ];

  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${palette[rank % palette.length]} text-[10px] font-bold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]`}>
      {label}
    </div>
  );
}

export function ProfitableTradersCard({ entries }: { entries: Entry[] }) {
  const topEntries = entries.slice(0, 8);

  return (
    <section className="overflow-hidden rounded-2xl border border-card-border bg-[linear-gradient(180deg,#0f1118_0%,#090b10_100%)] shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/80">
            Profitable Traders
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Top wallets ranked by realized PnL and activity.
          </p>
        </div>
        <Link href="#full-leaderboard" className="text-sm font-medium text-primary transition-colors hover:text-primary-dim">
          View more
        </Link>
      </div>

      <div className="grid grid-cols-[1.55fr_0.7fr_0.7fr_0.55fr_0.55fr] gap-3 border-b border-white/5 bg-white/[0.02] px-4 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground sm:px-5">
        <span>Trader</span>
        <span className="text-right">7d PnL</span>
        <span className="text-right">ROI</span>
        <span className="text-right">Win Rate</span>
        <span className="text-right">7d Vol</span>
      </div>

      <div className="divide-y divide-white/5">
        {topEntries.map((entry) => (
          <div
            key={entry.wallet}
            className="grid grid-cols-[1.55fr_0.7fr_0.7fr_0.55fr_0.55fr] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] sm:px-5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <TraderMark wallet={entry.wallet} rank={entry.rank} />
              <div className="min-w-0">
                <Link
                  href={`/wallet/${entry.wallet}`}
                  className="block truncate font-mono text-sm text-primary transition-colors hover:text-primary-dim"
                >
                  {shortenAddress(entry.wallet)}
                </Link>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Rank #{entry.rank}</p>
              </div>
            </div>

            <div className={`text-right font-mono text-sm ${entry.pnlUsd >= 0 ? "text-emerald-400" : "text-danger"}`}>
              {formatUsd(entry.pnlUsd)}
            </div>

            <div className={`text-right font-mono text-sm ${entry.roiPercent >= 0 ? "text-emerald-400" : "text-danger"}`}>
              {formatPercent(entry.roiPercent)}
            </div>

            <div className="text-right font-mono text-sm text-foreground/90">
              {(entry.winRate * 100).toFixed(0)}%
            </div>

            <div className="text-right font-mono text-sm text-foreground/90">
              {formatUsd(entry.volumeUsd)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}