import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requireBusOwner } from "@/lib/auth-guard";

const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export async function GET(_req: NextRequest) {
  const { session, error } = await requireBusOwner();
  if (error) return error;

  const ownerId = session.user.id;

  try {
    const nowSL        = new Date(Date.now() + SL_OFFSET_MS);
    const todayStr     = nowSL.toISOString().slice(0, 10);
    const firstOfMonth = `${todayStr.slice(0, 8)}01`;

    const todayStartUTC = new Date(`${todayStr}T00:00:00.000Z`);
    todayStartUTC.setTime(todayStartUTC.getTime() - SL_OFFSET_MS);
    const todayEndUTC = new Date(todayStartUTC.getTime() + 24 * 60 * 60 * 1000);

    const monthStartUTC = new Date(`${firstOfMonth}T00:00:00.000Z`);
    monthStartUTC.setTime(monthStartUTC.getTime() - SL_OFFSET_MS);
    const monthEndUTC = todayEndUTC;

    const [monthBookings, totalJourneys] = await Promise.all([
      db.booking.findMany({
        where: {
          createdAt: { gte: monthStartUTC, lt: monthEndUTC },
          schedule:  { bus: { ownerId } },
        },
        include: { payment: true },
      }),
      db.schedule.count({
        where: {
          createdAt: { gte: monthStartUTC, lt: monthEndUTC },
          bus:       { ownerId },
        },
      }),
    ]);

    const todayBookings = monthBookings.filter(
      (b) => b.createdAt >= todayStartUTC && b.createdAt < todayEndUTC
    );

    const calcRevenue = (bookings: typeof monthBookings) =>
      bookings
        .filter((b) => b.status === "CONFIRMED")
        .reduce((sum, b) => sum + (b.payment ? Number(b.payment.amount) : 0), 0);

    return NextResponse.json({
      thisMonth: {
        totalBookings:     monthBookings.length,
        confirmedBookings: monthBookings.filter((b) => b.status === "CONFIRMED").length,
        cancelledBookings: monthBookings.filter((b) => b.status === "CANCELLED").length,
        totalRevenue:      calcRevenue(monthBookings),
        totalJourneys,
      },
      today: {
        totalBookings:     todayBookings.length,
        confirmedBookings: todayBookings.filter((b) => b.status === "CONFIRMED").length,
        totalRevenue:      calcRevenue(todayBookings),
      },
    });
  } catch (err) {
    console.error("[GET /api/portal/stats/:ownerId]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
