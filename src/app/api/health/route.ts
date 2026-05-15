import { NextResponse } from "next/server";
import { success } from "@/lib/api-response";

export async function GET() {
  return NextResponse.json(
    success(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "AlphaTrace v1.0",
      },
      { source: "AlphaTrace" }
    )
  );
}
