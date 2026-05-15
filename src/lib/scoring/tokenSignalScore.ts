export interface TokenSignalInput {
  smartWalletCount: number;
  averageAlphaScore: number;
  combinedWalletPnl: number;
  averagePortfolioWeight: number;
  liquidityUsd: number;
  securityPassed: boolean | null;
  isFresh: boolean;
}

export interface TokenSignalResult {
  signalScore: number;
  signalLabel: string;
  breakdown: {
    smartWalletCount: number;
    averageAlpha: number;
    combinedPnl: number;
    portfolioExposure: number;
    liquidity: number;
    security: number;
    freshness: number;
  };
  explanation: string;
}

function norm(value: number, max: number): number {
  return Math.min(100, Math.max(0, (value / max) * 100));
}

export function computeTokenSignalScore(input: TokenSignalInput): TokenSignalResult {
  const smartWalletCountScore = norm(input.smartWalletCount, 10);
  const averageAlphaScore = input.averageAlphaScore;
  const combinedPnlScore = norm(Math.abs(input.combinedWalletPnl), 2000000);
  const portfolioExposureScore = norm(input.averagePortfolioWeight * 100, 30);
  const liquidityScore = norm(input.liquidityUsd, 500000);
  const securityScore = input.securityPassed === true ? 100 : input.securityPassed === false ? 0 : 50;
  const freshnessScore = input.isFresh ? 80 : 30;

  const rawScore =
    smartWalletCountScore * 0.25 +
    averageAlphaScore * 0.2 +
    combinedPnlScore * 0.2 +
    portfolioExposureScore * 0.1 +
    liquidityScore * 0.1 +
    securityScore * 0.1 +
    freshnessScore * 0.05;

  const signalScore = Math.round(Math.min(100, Math.max(0, rawScore)));

  let signalLabel: string;
  if (signalScore >= 80) signalLabel = "Strong Smart Money Signal";
  else if (signalScore >= 60) signalLabel = "Emerging Smart Money Signal";
  else if (signalScore >= 40) signalLabel = "Weak / Noisy Signal";
  else signalLabel = "Ignore";

  const securityText =
    input.securityPassed === true
      ? "Token security check passed"
      : input.securityPassed === false
        ? "Security concerns detected"
        : "Security status unknown";

  const liquidityText =
    input.liquidityUsd > 100000
      ? "Liquidity appears acceptable"
      : input.liquidityUsd > 10000
        ? "Liquidity is low"
        : "Liquidity is very low";

  const explanation = `${input.smartWalletCount} high-alpha wallet${input.smartWalletCount !== 1 ? "s have" : " has"} exposure to this token. Average wallet Alpha Score is ${Math.round(input.averageAlphaScore)}, with combined realized PNL of $${Math.abs(input.combinedWalletPnl).toLocaleString()}. ${securityText}. ${liquidityText}.`;

  return {
    signalScore,
    signalLabel,
    breakdown: {
      smartWalletCount: Math.round(smartWalletCountScore),
      averageAlpha: Math.round(averageAlphaScore),
      combinedPnl: Math.round(combinedPnlScore),
      portfolioExposure: Math.round(portfolioExposureScore),
      liquidity: Math.round(liquidityScore),
      security: Math.round(securityScore),
      freshness: Math.round(freshnessScore),
    },
    explanation,
  };
}
