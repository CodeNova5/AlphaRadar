export type Archetype =
  | "Elite Alpha"
  | "Alpha Hunter"
  | "Consistent Compounder"
  | "One-Hit Wonder"
  | "Rotator"
  | "Inactive Winner"
  | "Exit Liquidity"
  | "Newcomer";

export interface ArchetypeResult {
  archetype: Archetype;
  explanation: string;
}

export function classifyArchetype(input: {
  alphaScore: number;
  roiPercent: number;
  winRate: number;
  pnlConcentration: number;
  recentActivity: boolean;
  realizedPnlUsd: number;
  tradeCount: number;
  walletAgeDays: number;
}): ArchetypeResult {
  const {
    alphaScore,
    roiPercent,
    winRate,
    pnlConcentration,
    recentActivity,
    realizedPnlUsd,
    tradeCount,
    walletAgeDays,
  } = input;

  if (walletAgeDays < 7 && tradeCount < 5) {
    return {
      archetype: "Newcomer",
      explanation: "Wallet is too new to classify reliably.",
    };
  }

  if (realizedPnlUsd < 0 && winRate < 0.35) {
    return {
      archetype: "Exit Liquidity",
      explanation: "Negative PNL with poor win rate suggests this wallet is consistently losing.",
    };
  }

  if (alphaScore >= 85 && recentActivity) {
    return {
      archetype: "Elite Alpha",
      explanation: "High Alpha Score with active trading. This wallet demonstrates elite-level performance.",
    };
  }

  if (pnlConcentration > 0.7 && realizedPnlUsd > 0) {
    return {
      archetype: "One-Hit Wonder",
      explanation: "One token dominates profits. Performance may not be repeatable.",
    };
  }

  if (roiPercent > 200 && winRate < 0.5) {
    return {
      archetype: "Alpha Hunter",
      explanation: "High ROI with moderate win rate. Takes big swings that pay off when they hit.",
    };
  }

  if (winRate >= 0.6 && realizedPnlUsd > 0 && pnlConcentration < 0.5) {
    return {
      archetype: "Consistent Compounder",
      explanation: "Steady win rate across multiple tokens. Reliable, diversified performance.",
    };
  }

  if (tradeCount > 50 && pnlConcentration < 0.3) {
    return {
      archetype: "Rotator",
      explanation: "Many token rotations with distributed exposure. Active across many positions.",
    };
  }

  if (!recentActivity && realizedPnlUsd > 0) {
    return {
      archetype: "Inactive Winner",
      explanation: "Good historical performance but low recent activity. May have stopped trading.",
    };
  }

  return {
    archetype: "Consistent Compounder",
    explanation: "Moderate performance profile across multiple dimensions.",
  };
}
