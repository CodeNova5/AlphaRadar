"use client";

const WINDOWS = [
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
] as const;

export function WindowSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (w: string) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-surface p-1">
      {WINDOWS.map((w) => (
        <button
          key={w.value}
          onClick={() => onChange(w.value)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            value === w.value
              ? "bg-primary text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {w.label}
        </button>
      ))}
    </div>
  );
}
