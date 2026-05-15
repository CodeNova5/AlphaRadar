import { NextRequest, NextResponse } from "next/server";
import { success, fail } from "@/lib/api-response";
import { validateWalletAddress, sanitizeWallet } from "@/lib/wallet-validation";
import { buildWalletProfile } from "@/lib/services/walletProfileService";
import { getLatestLeaderboard } from "@/lib/services/leaderboardService";
import type { TimeWindow } from "@/lib/birdeye/types";

const VALID_WINDOWS: TimeWindow[] = ["24h", "7d", "30d"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const wallet = sanitizeWallet(address);
  const windowParam = req.nextUrl.searchParams.get("window") || "30d";

  const validationError = validateWalletAddress(wallet);
  if (validationError) {
    return NextResponse.json(fail(validationError), { status: 400 });
  }

  if (!VALID_WINDOWS.includes(windowParam as TimeWindow)) {
    return NextResponse.json(fail("Invalid window. Use 24h, 7d, or 30d"), { status: 400 });
  }

  try {
    const { profile, warnings } = await buildWalletProfile(wallet, windowParam as TimeWindow);

    // Compute percentile against leaderboard
    let percentile: number | null = null;
    try {
      const leaderboard = await getLatestLeaderboard(windowParam as TimeWindow, 100);
      if (leaderboard.entries.length > 0) {
        const scores = leaderboard.entries.map((e) => e.alphaScore);
        const below = scores.filter((s) => s < profile.alphaScore.score).length;
        percentile = Math.round((below / scores.length) * 100) / 100;
      }
    } catch {
      // Percentile is optional
    }

    const shareTitle = `I scored ${profile.alphaScore.score} on AlphaTrace`;
    const shareSubtitle = percentile !== null
      ? `Top ${(100 - percentile * 100).toFixed(0)}% of analyzed Solana wallets`
      : `Alpha Score: ${profile.alphaScore.score}`;

    return NextResponse.json(
      success(
        {
          wallet,
          pnlUsd: profile.summary.pnlUsd,
          roiPercent: profile.summary.roiPercent,
          alphaScore: profile.alphaScore.score,
          alphaClass: profile.alphaScore.alphaClass,
          confidence: profile.alphaScore.confidence,
          archetype: profile.archetype.archetype,
          archetypeExplanation: profile.archetype.explanation,
          percentile,
          shareCard: { title: shareTitle, subtitle: shareSubtitle },
        },
        {
          warnings: warnings.length > 0 ? warnings : undefined,
          freshness: "fresh",
          generatedAt: new Date().toISOString(),
          source: "AlphaTrace",
        }
      )
    );
  } catch (e) {
    return NextResponse.json(
      fail(`Failed to analyze wallet: ${(e as Error).message}`),
      { status: 500 }
    );
  }
}
