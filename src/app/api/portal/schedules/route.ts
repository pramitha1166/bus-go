import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { requireBusOwner } from "@/lib/auth-guard";
import { getSeatSelectionMode } from "@/lib/seatLayout";

const createScheduleSchema = z.object({
  busId:         z.string().min(1, "busId is required"),
  fromStationId: z.string().min(1, "fromStationId is required"),
  toStationId:   z.string().min(1, "toStationId is required"),
  departureAt:   z.string().min(1, "departureAt is required"),
  price:         z.number().positive("Price must be a positive number"),
  isRecurring:   z.boolean().default(true),
  activeDays:    z.string().default("1,2,3,4,5,6,7"),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireBusOwner();
  if (error) return error;

  const ownerId = session.user.id;

  try {
    const body   = await req.json();
    const result = createScheduleSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: z.flattenError(result.error).fieldErrors },
        { status: 400 }
      );
    }

    const { busId, fromStationId, toStationId, departureAt, price, isRecurring, activeDays } = result.data;

    // Verify bus belongs to this owner
    const bus = await db.bus.findUnique({ where: { id: busId } });
    if (!bus || bus.ownerId !== ownerId) {
      return NextResponse.json({ error: "This bus does not belong to you." }, { status: 403 });
    }

    const [fromStation, toStation] = await Promise.all([
      db.busStation.findUnique({ where: { id: fromStationId } }),
      db.busStation.findUnique({ where: { id: toStationId } }),
    ]);

    if (!fromStation) {
      return NextResponse.json({ error: `No station found with fromStationId "${fromStationId}".` }, { status: 404 });
    }
    if (!toStation) {
      return NextResponse.json({ error: `No station found with toStationId "${toStationId}".` }, { status: 404 });
    }

    let storedDepartureAt: Date;
    if (isRecurring) {
      const timePart = departureAt.includes("T") ? departureAt.split("T")[1].slice(0, 5) : departureAt.slice(0, 5);
      storedDepartureAt = new Date(`1970-01-01T${timePart}:00.000Z`);
    } else {
      storedDepartureAt = new Date(departureAt);
      if (isNaN(storedDepartureAt.getTime())) {
        return NextResponse.json({ error: "departureAt must be a valid ISO datetime for non-recurring schedules." }, { status: 400 });
      }
      if (storedDepartureAt <= new Date()) {
        return NextResponse.json({ error: "departureAt must be a future datetime." }, { status: 400 });
      }
    }

    const seatSelectionMode = getSeatSelectionMode(bus.busType);

    const schedule = await db.schedule.create({
      data: {
        busId,
        fromStationId,
        toStationId,
        departureAt:       storedDepartureAt,
        price,
        isRecurring,
        activeDays,
        seatSelectionMode,
        smsNotificationSent: false,
      },
      include: {
        fromStation: { select: { name: true } },
        toStation:   { select: { name: true } },
      },
    });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/portal/schedules]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
