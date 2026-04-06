import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/owners/:ownerId — full owner detail
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { ownerId: string } }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const owner = await db.busOwner.findUnique({
      where: { id: params.ownerId },
      include: {
        buses: {
          include: {
            schedules: {
              include: {
                bookings:    { include: { payment: { select: { amount: true } } } },
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
        { error: `No bus owner found with id "${params.ownerId}".` },
        { status: 404 }
      );
    }

    const buses = owner.buses.map((bus) => {
      const schedules = bus.schedules.map((schedule) => {
        const confirmed  = schedule.bookings.filter((b) => b.status === "CONFIRMED");
        const pending    = schedule.bookings.filter((b) => b.status === "PENDING");
        const cancelled  = schedule.bookings.filter((b) => b.status === "CANCELLED");
        const revenue    = confirmed.reduce(
          (sum, b) => sum + (b.payment ? Number(b.payment.amount) : 0), 0
        );

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
        createdAt:  bus.createdAt,
        schedules,
      };
    });

    return NextResponse.json({
      owner: {
        id:        owner.id,
        name:      owner.name,
        email:     owner.email,
        phone:     owner.phone,
        isActive:  owner.isActive,
        createdAt: owner.createdAt,
      },
      buses,
    });
  } catch (err) {
    console.error("[GET /api/admin/owners/:ownerId]", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/owners/:ownerId — soft-deactivate owner
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { ownerId: string } }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const owner = await db.busOwner.findUnique({
      where: { id: params.ownerId },
    });

    if (!owner) {
      return NextResponse.json(
        { error: `No bus owner found with id "${params.ownerId}".` },
        { status: 404 }
      );
    }

    // Collect all schedule IDs under this owner's buses (used for booking cancellation)
    const schedules = await db.schedule.findMany({
      where:  { bus: { ownerId: params.ownerId } },
      select: { id: true },
    });
    const scheduleIds = schedules.map((s) => s.id);

    // Soft delete + cancel pending bookings in a transaction
    await db.$transaction([
      // Cancel all PENDING bookings under this owner
      db.booking.updateMany({
        where: {
          status:     "PENDING",
          scheduleId: { in: scheduleIds },
        },
        data: { status: "CANCELLED" },
      }),
      // Deactivate the owner account
      db.busOwner.update({
        where: { id: params.ownerId },
        data:  { isActive: false },
      }),
    ]);

    return NextResponse.json({ message: "Owner deactivated successfully." });
  } catch (err) {
    console.error("[DELETE /api/admin/owners/:ownerId]", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
