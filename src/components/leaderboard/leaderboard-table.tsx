"use client";

import Link from "next/link";
import { AlphaScoreBadge } from "@/components/shared/alpha-score-badge";
import { formatUsd, formatPercent, shortenAddress } from "@/components/shared/format";

interface Entry {
  rank: number;
  wallet: string;
  pnlUsd: number;
  volumeUsd: number;
  roiPercent: number;
  winRate: number;
  alphaScore: number;
  alphaClass: string;
  confidence: string;
  walletAgeDays: number | null;
  archetype: string;
}

export function LeaderboardTable({ entries }: { entries: Entry[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-card-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface text-muted-foreground text-xs uppercase tracking-wider">
            <th className="px-4 py-3 text-left w-16">#</th>
            <th className="px-4 py-3 text-left">Wallet</th>
            <th className="px-4 py-3 text-right">PNL</th>
            <th className="px-4 py-3 text-right">7D VOL</th>
            <th className="px-4 py-3 text-right">ROI</th>
            <th className="px-4 py-3 text-right">Win Rate</th>
            <th className="px-4 py-3 text-center">Alpha Score</th>
            <th className="px-4 py-3 text-left">Archetype</th>
            <th className="px-4 py-3 text-right">Age</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-card-border">
          {entries.map((entry, i) => (
            <tr
              key={entry.wallet}
              className="hover:bg-surface/50 transition-colors animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <td className="px-4 py-3 font-mono text-muted-foreground">
                {entry.rank}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/wallet/${entry.wallet}`}
                  className="font-mono text-primary hover:underline"
                >
                  {shortenAddress(entry.wallet)}
                </Link>
              </td>
              <td className={`px-4 py-3 text-right font-mono ${entry.pnlUsd >= 0 ? "text-primary" : "text-danger"}`}>
                {formatUsd(entry.pnlUsd)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                {formatUsd(entry.volumeUsd)}
              </td>
              <td className={`px-4 py-3 text-right font-mono ${entry.roiPercent >= 0 ? "text-primary" : "text-danger"}`}>
                {formatPercent(entry.roiPercent)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                {(entry.winRate * 100).toFixed(0)}%
              </td>
              <td className="px-4 py-3 text-center">
                <AlphaScoreBadge score={entry.alphaScore} size="sm" />
              </td>
              <td className="px-4 py-3">
                <span className="text-xs font-medium text-muted-foreground bg-surface px-2 py-0.5 rounded">
                  {entry.archetype}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                {entry.walletAgeDays !== null ? `${entry.walletAgeDays}d` : "--"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
