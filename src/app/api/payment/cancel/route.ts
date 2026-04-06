import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message:
      "Payment cancelled. Your seat reservation will expire in 15 minutes.",
  });
}
