import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requireBusOwner } from "@/lib/auth-guard";

// The [ownerId] path segment is kept for URL stability but ignored —
// the owner identity is read from the session (session.user.id).
export async function GET(_req: NextRequest) {
  const { session, error } = await requireBusOwner();
  if (error) return error;

  const ownerId = session.user.id;

  try {
    const owner = await db.busOwner.findUnique({
      where: { id: ownerId },
      include: {
        buses: {
          include: {
            schedules: {
              include: {
                bookings:    { include: { payment: true } },
                fromStation: { select: { name: true } },
                toStation:   { select: { name: true } },
              },
              orderBy: { departureAt: "desc" },
            },
          },
        },
      },
    });

    if (!owner) {
      return NextResponse.json(
        { error: "Owner not found. Please check your owner ID." },
        { status: 404 }
      );
    }

    let totalSchedules          = 0;
    let totalConfirmedBookings  = 0;
    let totalRevenue            = 0;

    const buses = owner.buses.map((bus) => {
      totalSchedules += bus.schedules.length;

      const schedules = bus.schedules.map((schedule) => {
        const confirmed = schedule.bookings.filter((b) => b.status === "CONFIRMED");
        const pending   = schedule.bookings.filter((b) => b.status === "PENDING");
        const cancelled = schedule.bookings.filter((b) => b.status === "CANCELLED");

        const revenue = confirmed.reduce(
          (sum, b) => sum + (b.payment ? Number(b.payment.amount) : 0),
          0
        );

        totalConfirmedBookings += confirmed.length;
        totalRevenue           += revenue;

        return {
          id:                  schedule.id,
          from:                schedule.fromStation.name,
          to:                  schedule.toStation.name,
          departureAt:         schedule.departureAt,
          price:               Number(schedule.price),
          isRecurring:         schedule.isRecurring,
          isActive:            schedule.isActive,
          seatSelectionMode:   schedule.seatSelectionMode,
          smsNotificationSent: schedule.smsNotificationSent,
          confirmedBookings:   confirmed.length,
          pendingBookings:     pending.length,
          cancelledBookings:   cancelled.length,
          availableSeats:      bus.totalSeats - confirmed.length - pending.length,
          revenue,
        };
      });

      return {
        id:         bus.id,
        name:       bus.name,
        regNumber:  bus.registrationNumber,
        busType:    bus.busType,
        rows:       bus.rows,
        totalSeats: bus.totalSeats,
        schedules,
      };
    });

    return NextResponse.json({
      owner: {
        id:    owner.id,
        name:  owner.name,
        email: owner.email,
        phone: owner.phone,
      },
      stats: {
        totalBuses:             owner.buses.length,
        totalSchedules,
        totalConfirmedBookings,
        totalRevenue,
      },
      buses,
    });
  } catch (err) {
    console.error("[GET /api/portal/owner/:ownerId]", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
