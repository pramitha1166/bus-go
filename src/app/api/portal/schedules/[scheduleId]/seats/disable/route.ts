import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { requireBusOwner } from "@/lib/auth-guard";
import { sendSMS } from "@/lib/sms";

const bodySchema = z.object({
  seatLabel:   z.string().min(1, "seatLabel is required"),
  journeyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "journeyDate must be YYYY-MM-DD"),
});

// POST /api/portal/schedules/:scheduleId/seats/disable
export async function POST(
  req: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  const { session, error } = await requireBusOwner();
  if (error) return error;

  const ownerId = session.user.id;

  try {
    const body   = await req.json();
    const result = bodySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: z.flattenError(result.error).fieldErrors },
        { status: 400 }
      );
    }

    const { seatLabel, journeyDate: journeyDateStr } = result.data;
    const journeyDate = new Date(`${journeyDateStr}T00:00:00.000Z`);

    // Verify ownership
    const schedule = await db.schedule.findUnique({
      where:   { id: params.scheduleId },
      include: {
        bus:         { select: { ownerId: true } },
        fromStation: { select: { name: true } },
        toStation:   { select: { name: true } },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
    }
    if (schedule.bus.ownerId !== ownerId) {
      return NextResponse.json({ error: "You do not have access to this schedule." }, { status: 403 });
    }

    const route    = `${schedule.fromStation.name} → ${schedule.toStation.name}`;
    const dateStr  = journeyDate.toLocaleDateString("en-LK", {
      timeZone: "Asia/Colombo", year: "numeric", month: "short", day: "numeric",
    });

    // Upsert the ScheduleSeat record as disabled
    const scheduleSeat = await db.scheduleSeat.upsert({
      where: {
        scheduleId_seatLabel_journeyDate: {
          scheduleId: params.scheduleId,
          seatLabel,
          journeyDate,
        },
      },
      create: {
        scheduleId: params.scheduleId,
        seatLabel,
        journeyDate,
        isDisabled: true,
        disabledBy: ownerId,
        disabledAt: new Date(),
      },
      update: {
        isDisabled: true,
        disabledBy: ownerId,
        disabledAt: new Date(),
      },
      include: { booking: true },
    });

    // Cancel any booking linked to this seat
    if (scheduleSeat.booking) {
      const booking = scheduleSeat.booking;
      await db.booking.update({
        where: { id: booking.id },
        data:  { status: "CANCELLED" },
      });

      if (booking.status === "CONFIRMED") {
        // Notify the passenger
        await sendSMS(
          booking.passengerPhone,
          `We regret to inform you that your seat ${seatLabel} on ${route} on ${dateStr} has been cancelled by the operator. Please contact support.`
        );
      }
      // PENDING bookings are cancelled silently
    }

    return NextResponse.json({
      message:     "Seat disabled",
      seatLabel,
      journeyDate: journeyDateStr,
    });
  } catch (err) {
    console.error("[POST /api/portal/schedules/:scheduleId/seats/disable]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
