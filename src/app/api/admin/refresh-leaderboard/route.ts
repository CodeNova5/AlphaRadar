import { NextRequest, NextResponse } from "next/server";
import { success, fail } from "@/lib/api-response";
import { config } from "@/lib/config";
import { buildLeaderboard } from "@/lib/services/leaderboardService";
import type { TimeWindow } from "@/lib/birdeye/types";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = authHeader?.replace("Bearer ", "");

  if (secret !== config.admin.refreshSecret) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const window = (body.window || "7d") as TimeWindow;

  try {
    const result = await buildLeaderboard(window, 50);
    return NextResponse.json(
      success({
        window: result.window,
        walletCount: result.entries.length,
        generatedAt: result.generatedAt,
      }, { source: "AlphaTrace" })
    );
  } catch (e) {
    return NextResponse.json(
      fail(`Refresh failed: ${(e as Error).message}`),
      { status: 500 }
    );
  }
}
