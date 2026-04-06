import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export async function GET(_req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const nowSL        = new Date(Date.now() + SL_OFFSET_MS);
    const todayStr     = nowSL.toISOString().slice(0, 10);
    const firstOfMonth = `${todayStr.slice(0, 8)}01`;

    const todayStartUTC = new Date(`${todayStr}T00:00:00.000Z`);
    todayStartUTC.setTime(todayStartUTC.getTime() - SL_OFFSET_MS);
    const todayEndUTC   = new Date(todayStartUTC.getTime() + 24 * 60 * 60 * 1000);

    const monthStartUTC = new Date(`${firstOfMonth}T00:00:00.000Z`);
    monthStartUTC.setTime(monthStartUTC.getTime() - SL_OFFSET_MS);
    const monthEndUTC = todayEndUTC;

    const [
      todayBookings,
      monthBookings,
      todayNewOwners,
      todayNewBuses,
      allTimeCounts,
      allTimeRevenue,
      recentBookingsRaw,
    ] = await Promise.all([
      db.booking.findMany({
        where:   { createdAt: { gte: todayStartUTC, lt: todayEndUTC } },
        include: { payment: { select: { amount: true } } },
      }),

      db.booking.findMany({
        where:   { createdAt: { gte: monthStartUTC, lt: monthEndUTC } },
        include: {
          payment:  { select: { amount: true } },
          schedule: { select: { bus: { select: { ownerId: true } } } },
        },
      }),

      db.busOwner.count({ where: { createdAt: { gte: todayStartUTC, lt: todayEndUTC } } }),
      db.bus.count({ where: { createdAt: { gte: todayStartUTC, lt: todayEndUTC } } }),

      Promise.all([
        db.busOwner.count(),
        db.bus.count(),
        db.schedule.count(),
        db.booking.count(),
      ]),

      db.payment.aggregate({
        where: { booking: { status: "CONFIRMED" } },
        _sum:  { amount: true },
      }),

      db.booking.findMany({
        take:    10,
        orderBy: { createdAt: "desc" },
        include: {
          schedule: {
            include: {
              bus:         { select: { name: true } },
              fromStation: { select: { name: true } },
              toStation:   { select: { name: true } },
            },
          },
          scheduleSeat: { select: { seatLabel: true } },
          payment:      { select: { amount: true } },
        },
      }),
    ]);

    const todayConfirmed = todayBookings.filter((b) => b.status === "CONFIRMED");
    const todayPending   = todayBookings.filter((b) => b.status === "PENDING");
    const todayCancelled = todayBookings.filter((b) => b.status === "CANCELLED");
    const todayRevenue   = todayConfirmed.reduce(
      (sum, b) => sum + (b.payment ? Number(b.payment.amount) : 0), 0
    );

    const monthConfirmed = monthBookings.filter((b) => b.status === "CONFIRMED");
    const monthRevenue   = monthConfirmed.reduce(
      (sum, b) => sum + (b.payment ? Number(b.payment.amount) : 0), 0
    );
    const activeOwnerIds = new Set(monthConfirmed.map((b) => b.schedule.bus.ownerId));

    const [monthSchedules] = await Promise.all([
      db.schedule.count({ where: { createdAt: { gte: monthStartUTC, lt: monthEndUTC } } }),
    ]);

    const [totalBusOwners, totalBuses, totalSchedules, totalBookings] = allTimeCounts;
    const totalRevenue = Number(allTimeRevenue._sum.amount ?? 0);

    const recentBookings = recentBookingsRaw.map((b) => ({
      id:            b.id,
      passengerName: b.passengerName,
      busName:       b.schedule.bus.name,
      from:          b.schedule.fromStation.name,
      to:            b.schedule.toStation.name,
      seatLabel:     b.scheduleSeat?.seatLabel ?? null,
      journeyDate:   b.journeyDate,
      status:        b.status,
      paymentAmount: b.payment ? Number(b.payment.amount) : null,
      createdAt:     b.createdAt,
    }));

    return NextResponse.json({
      today: {
        totalBookings:     todayBookings.length,
        confirmedBookings: todayConfirmed.length,
        pendingBookings:   todayPending.length,
        cancelledBookings: todayCancelled.length,
        totalRevenue:      todayRevenue,
        newBusOwners:      todayNewOwners,
        newBuses:          todayNewBuses,
      },
      thisMonth: {
        totalBookings:     monthBookings.length,
        confirmedBookings: monthConfirmed.length,
        totalRevenue:      monthRevenue,
        totalJourneys:     monthSchedules,
        activeBusOwners:   activeOwnerIds.size,
      },
      allTime: { totalBusOwners, totalBuses, totalSchedules, totalBookings, totalRevenue },
      recentBookings,
    });
  } catch (err) {
    console.error("[GET /api/admin/dashboard]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
