export function AlphaScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const color =
    score >= 80
      ? "bg-primary/20 text-primary border-primary/30"
      : score >= 60
        ? "bg-accent/20 text-accent border-accent/30"
        : score >= 40
          ? "bg-muted/20 text-muted-foreground border-muted/30"
          : "bg-danger/20 text-danger border-danger/30";

  const sizeClass =
    size === "lg"
      ? "text-2xl font-bold px-4 py-2"
      : size === "md"
        ? "text-lg font-semibold px-3 py-1.5"
        : "text-sm font-medium px-2 py-0.5";

  return (
    <span className={`inline-flex items-center rounded-lg border ${color} ${sizeClass}`}>
      {score}
    </span>
  );
}
