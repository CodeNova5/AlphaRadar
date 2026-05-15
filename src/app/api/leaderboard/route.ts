import { NextRequest, NextResponse } from "next/server";
import { success, fail } from "@/lib/api-response";
import { getLatestLeaderboard } from "@/lib/services/leaderboardService";
import type { TimeWindow } from "@/lib/birdeye/types";

const VALID_WINDOWS: TimeWindow[] = ["24h", "7d", "30d"];

export async function GET(req: NextRequest) {
  const windowParam = (req.nextUrl.searchParams.get("window") || "7d") as TimeWindow;
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10);

  if (!VALID_WINDOWS.includes(windowParam)) {
    return NextResponse.json(fail("Invalid window. Use 24h, 7d, or 30d"), { status: 400 });
  }

  if (limit < 1 || limit > 100) {
    return NextResponse.json(fail("Limit must be between 1 and 100"), { status: 400 });
  }

  try {
    const result = await getLatestLeaderboard(windowParam, limit);
    return NextResponse.json(
      success(
        { window: result.window, generatedAt: result.generatedAt, entries: result.entries },
        {
          warnings: result.warnings.length > 0 ? result.warnings : undefined,
          freshness: "cached",
          generatedAt: result.generatedAt,
          source: "AlphaTrace",
        }
      )
    );
  } catch (e) {
    return NextResponse.json(
      fail(`Failed to load leaderboard: ${(e as Error).message}`),
      { status: 500 }
    );
  }
}
