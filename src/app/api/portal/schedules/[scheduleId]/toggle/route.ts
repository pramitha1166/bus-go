import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requireBusOwner } from "@/lib/auth-guard";

// PATCH /api/portal/schedules/:scheduleId/toggle
// Toggles isActive on a schedule. Cancels PENDING future bookings when deactivating.
export async function PATCH(
  _req: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  const { session, error } = await requireBusOwner();
  if (error) return error;

  const ownerId = session.user.id;

  try {
    const schedule = await db.schedule.findUnique({
      where:   { id: params.scheduleId },
      include: { bus: { select: { ownerId: true } } },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: `No schedule found with scheduleId "${params.scheduleId}".` },
        { status: 404 }
      );
    }

    if (schedule.bus.ownerId !== ownerId) {
      return NextResponse.json(
        { error: "You do not have access to this schedule." },
        { status: 403 }
      );
    }

    const newIsActive = !schedule.isActive;

    if (!newIsActive) {
      // Deactivating — cancel all PENDING future bookings
      const now = new Date();
      await db.booking.updateMany({
        where: {
          scheduleId:  params.scheduleId,
          status:      "PENDING",
          journeyDate: { gte: now },
        },
        data: { status: "CANCELLED" },
      });
    }

    const updated = await db.schedule.update({
      where: { id: params.scheduleId },
      data:  { isActive: newIsActive },
    });

    return NextResponse.json({
      id:       updated.id,
      isActive: updated.isActive,
      message:  newIsActive
        ? "Schedule activated successfully."
        : "Schedule deactivated. Pending bookings for future dates have been cancelled.",
    });
  } catch (err) {
    console.error("[PATCH /api/portal/schedules/:scheduleId/toggle]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
