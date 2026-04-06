import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import db from "@/lib/db";
import { sendDailyReport, sendSMS } from "@/lib/sms";
import { generateDailyReport, DailyBookingRow } from "@/lib/excel";

// Vercel Cron: "55 23 * * *" — runs at 11:55 PM every day (UTC)

const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowUTC    = new Date();
  const slNow     = new Date(nowUTC.getTime() + SL_OFFSET_MS);
  const slDateStr = slNow.toISOString().slice(0, 10);

  const startUTC = new Date(`${slDateStr}T00:00:00.000Z`);
  startUTC.setTime(startUTC.getTime() - SL_OFFSET_MS);
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);

  console.info(`[cron/daily-report] Running for SL date ${slDateStr}`);

  try {
    const bookings = await db.booking.findMany({
      where:   { createdAt: { gte: startUTC, lt: endUTC } },
      include: {
        schedule: {
          include: {
            bus:         { include: { owner: true } },
            fromStation: { select: { name: true } },
            toStation:   { select: { name: true } },
          },
        },
        scheduleSeat: { select: { seatLabel: true } },
        payment:      true,
      },
      orderBy: [{ journeyDate: "asc" }, { createdAt: "asc" }],
    });

    type BookingRecord = typeof bookings[number];

    console.info(`[cron/daily-report] Found ${bookings.length} booking(s) for today.`);

    const rows: DailyBookingRow[] = bookings.map((b: BookingRecord) => ({
      seatLabel:      b.scheduleSeat?.seatLabel ?? null,
      passengerName:  b.passengerName,
      passengerPhone: b.passengerPhone,
      busName:        b.schedule.bus.name,
      route:          `${b.schedule.fromStation.name} → ${b.schedule.toStation.name}`,
      departureTime:  b.schedule.departureAt,
      bookingStatus:  b.status,
      paymentAmount:  b.payment ? Number(b.payment.amount) : null,
      paymentRef:     b.payment?.gatewayReference ?? null,
      journeyDate:    b.journeyDate,
    }));

    // Excel (non-fatal)
    try {
      const buffer   = await generateDailyReport(rows, slDateStr);
      const filePath = join("/tmp", `daily-report-${slDateStr}.xlsx`);
      await writeFile(filePath, buffer);
    } catch (excelErr) {
      console.error("[cron/daily-report] Excel generation failed:", excelErr);
    }

    const totalBookings  = bookings.length;
    const confirmedList  = bookings.filter((b: BookingRecord) => b.status === "CONFIRMED");
    const confirmedCount = confirmedList.length;
    const cancelledCount = bookings.filter((b: BookingRecord) => b.status === "CANCELLED").length;
    const totalRevenue   = confirmedList.reduce(
      (sum: number, b: BookingRecord) => sum + (b.payment ? Number(b.payment.amount) : 0), 0
    );

    // Admin SMS (non-fatal)
    try {
      await sendDailyReport(process.env.ADMIN_PHONE!, confirmedCount, totalRevenue);
    } catch (smsErr) {
      console.error("[cron/daily-report] Admin SMS failed:", smsErr);
    }

    // Per-owner SMS (non-fatal)
    const ownerMap = new Map<string, { phone: string; busName: string; confirmedCount: number; revenue: number }>();
    for (const b of bookings as BookingRecord[]) {
      const { owner } = b.schedule.bus;
      if (!ownerMap.has(owner.id)) {
        ownerMap.set(owner.id, { phone: owner.phone, busName: b.schedule.bus.name, confirmedCount: 0, revenue: 0 });
      }
      const entry = ownerMap.get(owner.id)!;
      if (b.status === "CONFIRMED") {
        entry.confirmedCount++;
        entry.revenue += b.payment ? Number(b.payment.amount) : 0;
      }
    }

    for (const [ownerId, stats] of Array.from(ownerMap)) {
      try {
        await sendSMS(
          stats.phone,
          `Daily Summary\nBus: ${stats.busName}\nConfirmed: ${stats.confirmedCount} booking(s)\nRevenue: LKR ${stats.revenue.toFixed(2)}\n— Bus Booking System`
        );
      } catch (smsErr) {
        console.error(`[cron/daily-report] Owner SMS failed for ${ownerId}:`, smsErr);
      }
    }

    return NextResponse.json({ date: slDateStr, totalBookings, confirmed: confirmedCount, cancelled: cancelledCount, totalRevenue });
  } catch (err) {
    console.error("[cron/daily-report]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
