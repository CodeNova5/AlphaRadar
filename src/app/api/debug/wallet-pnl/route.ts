import { NextRequest, NextResponse } from "next/server";
import { success, fail } from "@/lib/api-response";
import { validateWalletAddress, sanitizeWallet } from "@/lib/wallet-validation";
import { getWalletPnlSummary, getWalletPnlDetails } from "@/lib/birdeye/endpoints";
import type { TimeWindow } from "@/lib/birdeye/types";

const VALID_WINDOWS: TimeWindow[] = ["24h", "7d", "30d"];

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  const window = (req.nextUrl.searchParams.get("window") || "7d") as TimeWindow;

  if (!wallet) {
    return NextResponse.json(fail("Missing wallet parameter"), { status: 400 });
  }

  const sanitized = sanitizeWallet(wallet);
  const validationError = validateWalletAddress(sanitized);
  if (validationError) {
    return NextResponse.json(fail(validationError), { status: 400 });
  }

  if (!VALID_WINDOWS.includes(window)) {
    return NextResponse.json(fail("Invalid window. Use 24h, 7d, or 30d"), { status: 400 });
  }

  const warnings: string[] = [];
  let pnlSummary = null;
  let pnlDetails = null;

  try {
    pnlSummary = await getWalletPnlSummary(sanitized, window);
  } catch (e) {
    warnings.push(`PNL summary failed: ${(e as Error).message}`);
  }

  try {
    pnlDetails = await getWalletPnlDetails(sanitized, window);
  } catch (e) {
    warnings.push(`PNL details failed: ${(e as Error).message}`);
  }

  return NextResponse.json(
    success(
      { wallet: sanitized, pnlSummary, pnlDetails },
      {
        warnings: warnings.length > 0 ? warnings : undefined,
        freshness: "fresh",
        generatedAt: new Date().toISOString(),
        source: "Birdeye",
      }
    )
  );
}
