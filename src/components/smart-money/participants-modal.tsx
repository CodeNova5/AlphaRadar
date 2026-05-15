"use client";

import { shortenAddress, formatUsd } from "@/components/shared/format";
import Link from "next/link";

interface Participant {
  wallet: string;
  walletAlphaScore: number;
  walletPnlUsd: number;
  holdingValueUsd: number;
  portfolioWeight: number;
}

export function ParticipantsModal({
  participants,
  onClose,
}: {
  participants: Participant[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-card-border rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Participating Smart Wallets</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">
            x
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground uppercase tracking-wider">
              <th className="pb-2 text-left">Wallet</th>
              <th className="pb-2 text-right">Alpha</th>
              <th className="pb-2 text-right">PNL</th>
              <th className="pb-2 text-right">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {participants.map((p) => (
              <tr key={p.wallet} className="hover:bg-surface/30">
                <td className="py-2">
                  <Link
                    href={`/wallet/${p.wallet}`}
                    className="font-mono text-primary hover:underline text-xs"
                  >
                    {shortenAddress(p.wallet)}
                  </Link>
                </td>
                <td className="py-2 text-right font-mono">{p.walletAlphaScore}</td>
                <td className={`py-2 text-right font-mono ${p.walletPnlUsd >= 0 ? "text-primary" : "text-danger"}`}>
                  {formatUsd(p.walletPnlUsd)}
                </td>
                <td className="py-2 text-right font-mono text-muted-foreground">
                  {formatUsd(p.holdingValueUsd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
