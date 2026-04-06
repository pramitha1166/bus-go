import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { requireBusOwner } from "@/lib/auth-guard";

const bodySchema = z.object({
  seatLabel:   z.string().min(1, "seatLabel is required"),
  journeyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "journeyDate must be YYYY-MM-DD"),
});

// POST /api/portal/schedules/:scheduleId/seats/enable
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
      include: { bus: { select: { ownerId: true } } },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
    }
    if (schedule.bus.ownerId !== ownerId) {
      return NextResponse.json({ error: "You do not have access to this schedule." }, { status: 403 });
    }

    const existing = await db.scheduleSeat.findUnique({
      where: {
        scheduleId_seatLabel_journeyDate: {
          scheduleId: params.scheduleId,
          seatLabel,
          journeyDate,
        },
      },
    });

    if (!existing) {
      // Nothing to enable — seat was never disabled
      return NextResponse.json({ message: "Seat enabled", seatLabel, journeyDate: journeyDateStr });
    }

    await db.scheduleSeat.update({
      where: { id: existing.id },
      data:  { isDisabled: false, disabledBy: null, disabledAt: null },
    });

    return NextResponse.json({ message: "Seat enabled", seatLabel, journeyDate: journeyDateStr });
  } catch (err) {
    console.error("[POST /api/portal/schedules/:scheduleId/seats/enable]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
