import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const querySchema = z.object({
  period: z.enum(["today", "week", "month", "year"]).optional().default("month"),
});

function toSLDateStr(d: Date): string {
  return new Date(d.getTime() + SL_OFFSET_MS).toISOString().slice(0, 10);
}

function generateDateRange(fromStr: string, toStr: string): string[] {
  const dates: string[] = [];
  let cur = new Date(`${fromStr}T00:00:00.000Z`);
  const end = new Date(`${toStr}T00:00:00.000Z`);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
  }
  return dates;
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({ period: searchParams.get("period") ?? undefined });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fields: z.flattenError(parsed.error).fieldErrors },
      { status: 400 }
    );
  }

  const { period } = parsed.data;

  try {
    const nowSL    = new Date(Date.now() + SL_OFFSET_MS);
    const todayStr = nowSL.toISOString().slice(0, 10);

    let periodStartStr: string;
    switch (period) {
      case "today": periodStartStr = todayStr; break;
      case "week":
        periodStartStr = new Date(Date.now() + SL_OFFSET_MS - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        break;
      case "month": periodStartStr = `${todayStr.slice(0, 8)}01`; break;
      case "year":  periodStartStr = `${todayStr.slice(0, 4)}-01-01`; break;
    }

    const startUTC = new Date(`${periodStartStr}T00:00:00.000Z`);
    startUTC.setTime(startUTC.getTime() - SL_OFFSET_MS);
    const endUTC = new Date(
      new Date(`${todayStr}T00:00:00.000Z`).getTime() - SL_OFFSET_MS + 24 * 60 * 60 * 1000
    );

    const bookings = await db.booking.findMany({
      where: {
        status:    "CONFIRMED",
        createdAt: { gte: startUTC, lt: endUTC },
        payment:   { isNot: null },
      },
      include: {
        payment:  { select: { amount: true } },
        schedule: {
          include: {
            bus:         { select: { name: true } },
            fromStation: { select: { name: true } },
            toStation:   { select: { name: true } },
          },
        },
      },
    });

    const totalRevenue           = bookings.reduce((sum, b) => sum + (b.payment ? Number(b.payment.amount) : 0), 0);
    const totalConfirmedBookings = bookings.length;
    const averageBookingValue    = totalConfirmedBookings > 0
      ? parseFloat((totalRevenue / totalConfirmedBookings).toFixed(2))
      : 0;

    // revenueByDay
    const dayMap = new Map<string, { revenue: number; bookings: number }>();
    for (const dateStr of generateDateRange(periodStartStr, todayStr)) {
      dayMap.set(dateStr, { revenue: 0, bookings: 0 });
    }
    for (const b of bookings) {
      const slDate = toSLDateStr(b.createdAt);
      if (dayMap.has(slDate)) {
        const entry = dayMap.get(slDate)!;
        entry.revenue  += b.payment ? Number(b.payment.amount) : 0;
        entry.bookings += 1;
      }
    }
    const revenueByDay = Array.from(dayMap.entries()).map(([date, v]) => ({
      date, revenue: parseFloat(v.revenue.toFixed(2)), bookings: v.bookings,
    }));

    // revenueByBus
    const busMap = new Map<string, { revenue: number; bookings: number }>();
    for (const b of bookings) {
      const busName = b.schedule.bus.name;
      const entry   = busMap.get(busName) ?? { revenue: 0, bookings: 0 };
      entry.revenue  += b.payment ? Number(b.payment.amount) : 0;
      entry.bookings += 1;
      busMap.set(busName, entry);
    }
    const revenueByBus = Array.from(busMap.entries())
      .map(([busName, v]) => ({ busName, revenue: parseFloat(v.revenue.toFixed(2)), bookings: v.bookings }))
      .sort((a, b) => b.revenue - a.revenue);

    // revenueByRoute
    const routeMap = new Map<string, { from: string; to: string; revenue: number; bookings: number }>();
    for (const b of bookings) {
      const key   = `${b.schedule.fromStation.name}||${b.schedule.toStation.name}`;
      const entry = routeMap.get(key) ?? {
        from: b.schedule.fromStation.name, to: b.schedule.toStation.name, revenue: 0, bookings: 0,
      };
      entry.revenue  += b.payment ? Number(b.payment.amount) : 0;
      entry.bookings += 1;
      routeMap.set(key, entry);
    }
    const revenueByRoute = Array.from(routeMap.values())
      .map((v) => ({ from: v.from, to: v.to, revenue: parseFloat(v.revenue.toFixed(2)), bookings: v.bookings }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      period,
      totalRevenue:           parseFloat(totalRevenue.toFixed(2)),
      totalConfirmedBookings,
      averageBookingValue,
      revenueByDay,
      revenueByBus,
      revenueByRoute,
    });
  } catch (err) {
    console.error("[GET /api/admin/revenue]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
