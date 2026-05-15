import { AlphaScoreBadge } from "@/components/shared/alpha-score-badge";

interface AlphaScoreBreakdownProps {
  score: number;
  alphaClass: string;
  confidence: string;
  confidenceReason: string;
  archetype: string;
  archetypeExplanation: string;
  riskFlags: string[];
}

export function AlphaScoreBreakdown({
  score,
  alphaClass,
  confidence,
  confidenceReason,
  archetype,
  archetypeExplanation,
  riskFlags,
}: AlphaScoreBreakdownProps) {
  const confidenceColor =
    confidence === "high"
      ? "text-primary"
      : confidence === "medium"
        ? "text-accent"
        : "text-danger";

  return (
    <div className="rounded-xl border border-card-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Alpha Score</h3>
        <AlphaScoreBadge score={score} size="lg" />
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Class:</span>
        <span className="text-sm font-medium">{alphaClass}</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Confidence:</span>
        <span className={`text-sm font-medium capitalize ${confidenceColor}`}>
          {confidence}
        </span>
        <span className="text-xs text-muted-foreground">({confidenceReason})</span>
      </div>

      <div className="border-t border-card-border pt-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Archetype:</span>
          <span className="text-sm font-semibold text-primary">{archetype}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{archetypeExplanation}</p>
      </div>

      {riskFlags.length > 0 && (
        <div className="border-t border-card-border pt-4">
          <p className="text-xs text-danger font-medium mb-2">Risk Flags</p>
          {riskFlags.map((flag, i) => (
            <p key={i} className="text-xs text-danger/80">- {flag}</p>
          ))}
        </div>
      )}
    </div>
  );
}
