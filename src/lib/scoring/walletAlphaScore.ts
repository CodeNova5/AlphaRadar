export interface ScoreInput {
  realizedPnlUsd: number;
  roiPercent: number;
  winRate: number;
  tradeCount: number;
  tokenCount: number;
  walletAgeDays: number;
  volumeUsd: number;
  recentActivity: boolean;
  pnlConcentration: number; // 0-1, how much one token dominates
}

export interface ScoreResult {
  alphaScore: number;
  alphaClass: string;
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
  breakdown: {
    realizedPnl: { value: number; label: string };
    roi: { value: number; label: string };
    winRate: { value: number; label: string };
    consistency: { value: number; label: string };
    walletAge: { value: number; label: string };
    recency: { value: number; label: string };
    riskPenalty: { value: number; label: string };
  };
  riskFlags: string[];
}

function normalize(value: number, max: number): number {
  return Math.min(100, Math.max(0, (value / max) * 100));
}

function label(value: number): string {
  if (value >= 75) return "strong";
  if (value >= 45) return "medium";
  return "low";
}

export function computeAlphaScore(input: ScoreInput): ScoreResult {
  const realizedPnlScore = normalize(Math.abs(input.realizedPnlUsd), 500000);
  const roiScore = normalize(Math.abs(input.roiPercent), 500);
  const winRateScore = input.winRate * 100;
  const consistencyScore = Math.max(0, 100 - input.pnlConcentration * 100);
  const walletAgeScore = normalize(input.walletAgeDays, 730);
  const recencyScore = input.recentActivity ? 80 : 20;

  const riskFlags: string[] = [];
  let riskPenalty = 0;

  if (input.pnlConcentration > 0.8) {
    riskFlags.push("One token dominates profits");
    riskPenalty += 30;
  }
  if (input.tradeCount < 5) {
    riskFlags.push("Very few trades");
    riskPenalty += 20;
  }
  if (input.walletAgeDays < 7) {
    riskFlags.push("Very new wallet");
    riskPenalty += 15;
  }
  if (input.realizedPnlUsd < 0) {
    riskPenalty += 25;
  }

  const rawScore =
    realizedPnlScore * 0.25 +
    roiScore * 0.2 +
    winRateScore * 0.15 +
    consistencyScore * 0.15 +
    walletAgeScore * 0.1 +
    recencyScore * 0.1 -
    riskPenalty * 0.05;

  const alphaScore = Math.round(Math.min(100, Math.max(0, rawScore)));

  let alphaClass: string;
  if (alphaScore >= 85) alphaClass = "Elite Alpha";
  else if (alphaScore >= 70) alphaClass = "Strong Trader";
  else if (alphaScore >= 55) alphaClass = "Moderate";
  else if (alphaScore >= 35) alphaClass = "Below Average";
  else alphaClass = "Exit Liquidity";

  let confidence: "high" | "medium" | "low";
  let confidenceReason: string;

  if (input.tradeCount >= 20 && input.walletAgeDays >= 30 && input.tokenCount >= 3) {
    confidence = "high";
    confidenceReason = "Sufficient trade history and wallet age for reliable scoring";
  } else if (input.tradeCount >= 5 && input.walletAgeDays >= 7) {
    confidence = "medium";
    confidenceReason = "Limited trade history or wallet age reduces score reliability";
  } else {
    confidence = "low";
    confidenceReason = "Very few trades or very new wallet; score may not reflect true ability";
  }

  return {
    alphaScore,
    alphaClass,
    confidence,
    confidenceReason,
    breakdown: {
      realizedPnl: { value: Math.round(realizedPnlScore), label: label(realizedPnlScore) },
      roi: { value: Math.round(roiScore), label: label(roiScore) },
      winRate: { value: Math.round(winRateScore), label: label(winRateScore) },
      consistency: { value: Math.round(consistencyScore), label: label(consistencyScore) },
      walletAge: { value: Math.round(walletAgeScore), label: label(walletAgeScore) },
      recency: { value: Math.round(recencyScore), label: label(recencyScore) },
      riskPenalty: { value: Math.round(riskPenalty), label: riskPenalty > 0 ? "active" : "low" },
    },
    riskFlags,
  };
}
