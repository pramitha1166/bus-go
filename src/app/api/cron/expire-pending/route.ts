import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// Vercel Cron: "*/10 * * * *" — runs every 10 minutes
// 1. Cancels PENDING bookings whose 15-minute payment window has expired.
// 2. Deletes OtpCode records older than 1 hour (expired and/or used).

const PENDING_TTL_MINUTES = 15;
const OTP_CLEANUP_HOURS   = 1;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bookingThreshold = new Date(Date.now() - PENDING_TTL_MINUTES * 60 * 1000);
  const otpThreshold     = new Date(Date.now() - OTP_CLEANUP_HOURS   * 60 * 60 * 1000);

  try {
    const [bookingResult, otpResult] = await Promise.all([
      // Cancel expired PENDING bookings
      db.booking.updateMany({
        where: {
          status:    "PENDING",
          createdAt: { lt: bookingThreshold },
        },
        data: { status: "CANCELLED" },
      }),

      // Delete OTP records older than 1 hour (expired or already used)
      db.otpCode.deleteMany({
        where: {
          createdAt: { lt: otpThreshold },
        },
      }),
    ]);

    return NextResponse.json({
      expiredBookings: bookingResult.count,
      deletedOtps:     otpResult.count,
    });
  } catch (err) {
    console.error("[cron/expire-pending]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
