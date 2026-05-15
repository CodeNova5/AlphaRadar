import { formatUsd, formatPercent } from "@/components/shared/format";

interface TokenPnlRow {
  tokenAddress: string;
  symbol: string;
  name: string;
  logoUri: string;
  realizedPnlUsd: number;
  roiPercent: number;
}

export function TokenPnlTable({
  tokens,
  title,
}: {
  tokens: TokenPnlRow[];
  title: string;
}) {
  if (tokens.length === 0) return null;

  return (
    <div className="rounded-xl border border-card-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-card-border">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground uppercase tracking-wider bg-surface/50">
            <th className="px-4 py-2 text-left">Token</th>
            <th className="px-4 py-2 text-right">Realized PNL</th>
            <th className="px-4 py-2 text-right">ROI</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-card-border">
          {tokens.map((t) => (
            <tr key={t.tokenAddress} className="hover:bg-surface/30 transition-colors">
              <td className="px-4 py-2 flex items-center gap-2">
                {t.logoUri && (
                  <img src={t.logoUri} alt="" className="h-5 w-5 rounded-full" />
                )}
                <span className="font-medium">{t.symbol || t.tokenAddress.slice(0, 8)}</span>
                {t.name && <span className="text-muted-foreground text-xs">{t.name}</span>}
              </td>
              <td className={`px-4 py-2 text-right font-mono ${t.realizedPnlUsd >= 0 ? "text-primary" : "text-danger"}`}>
                {formatUsd(t.realizedPnlUsd)}
              </td>
              <td className={`px-4 py-2 text-right font-mono ${t.roiPercent >= 0 ? "text-primary" : "text-danger"}`}>
                {formatPercent(t.roiPercent)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
