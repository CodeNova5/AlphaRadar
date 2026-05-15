"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface NetWorthChartProps {
  data: { timestamp: number; valueUsd: number }[];
}

export function NetWorthChart({ data }: NetWorthChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-card-border bg-card p-6 text-center">
        <p className="text-muted-foreground text-sm">Net worth history unavailable</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: new Date(d.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: d.valueUsd,
  }));

  return (
    <div className="rounded-xl border border-card-border bg-card p-4">
      <h3 className="text-sm font-semibold mb-4">Net Worth History</h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
          />
          <Tooltip
            contentStyle={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 8 }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, "Value"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#10b981"
            fill="url(#netWorthGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
