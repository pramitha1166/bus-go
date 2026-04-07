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

    // FIXED: Extract time and store in departureTime
    const time = new Date(departureAt)
    const departureTime = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`

    const seatSelectionMode = getSeatSelectionMode(bus.busType);

    const schedule = await db.schedule.create({
      data: {
        busId,
        fromStationId,
        toStationId,
        departureTime, // FIXED: stores "HH:MM"
        departureAt: isRecurring ? null : new Date(departureAt), // FIXED: null if recurring
        isRecurring,
        activeDays,
        price,
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
