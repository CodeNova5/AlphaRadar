import { formatUsd } from "@/components/shared/format";

interface Holding {
  tokenAddress: string;
  symbol: string;
  name: string;
  logoUri: string;
  balance: number;
  valueUsd: number;
  portfolioWeight: number;
}

export function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  if (holdings.length === 0) {
    return (
      <div className="rounded-xl border border-card-border bg-card p-6 text-center">
        <p className="text-muted-foreground text-sm">No holdings data available</p>
      </div>
    );
  }

  const sorted = [...holdings].sort((a, b) => b.valueUsd - a.valueUsd);

  return (
    <div className="rounded-xl border border-card-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-card-border">
        <h3 className="text-sm font-semibold">Current Holdings</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground uppercase tracking-wider bg-surface/50">
            <th className="px-4 py-2 text-left">Token</th>
            <th className="px-4 py-2 text-right">Value</th>
            <th className="px-4 py-2 text-right">Weight</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-card-border">
          {sorted.slice(0, 20).map((h) => (
            <tr key={h.tokenAddress} className="hover:bg-surface/30 transition-colors">
              <td className="px-4 py-2 flex items-center gap-2">
                {h.logoUri && (
                  <img src={h.logoUri} alt="" className="h-5 w-5 rounded-full" />
                )}
                <span className="font-medium">{h.symbol || h.tokenAddress.slice(0, 8)}</span>
              </td>
              <td className="px-4 py-2 text-right font-mono text-foreground">
                {formatUsd(h.valueUsd)}
              </td>
              <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                {(h.portfolioWeight * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
