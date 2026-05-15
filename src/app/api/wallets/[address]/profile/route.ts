import { NextRequest, NextResponse } from "next/server";
import { success, fail } from "@/lib/api-response";
import { validateWalletAddress, sanitizeWallet } from "@/lib/wallet-validation";
import { buildWalletProfile } from "@/lib/services/walletProfileService";
import type { TimeWindow } from "@/lib/birdeye/types";

const VALID_WINDOWS: TimeWindow[] = ["24h", "7d", "30d"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const wallet = sanitizeWallet(address);
  const windowParam = req.nextUrl.searchParams.get("window") || "7d";

  const validationError = validateWalletAddress(wallet);
  if (validationError) {
    return NextResponse.json(fail(validationError), { status: 400 });
  }

  if (!VALID_WINDOWS.includes(windowParam as TimeWindow)) {
    return NextResponse.json(fail("Invalid window. Use 24h, 7d, or 30d"), { status: 400 });
  }

  try {
    const { profile, warnings } = await buildWalletProfile(wallet, windowParam as TimeWindow);
    return NextResponse.json(
      success(profile, {
        warnings: warnings.length > 0 ? warnings : undefined,
        freshness: "fresh",
        generatedAt: new Date().toISOString(),
        source: "AlphaTrace",
      })
    );
  } catch (e) {
    return NextResponse.json(
      fail(`Failed to build wallet profile: ${(e as Error).message}`),
      { status: 500 }
    );
  }
}
