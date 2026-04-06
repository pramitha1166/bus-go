import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { getSeatSelectionMode } from "@/lib/seatLayout";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Convert a YYYY-MM-DD date string to the ISO 8601 day-of-week number
 *  where 1 = Monday … 7 = Sunday (matches activeDays format). */
function getActiveDayNumber(dateStr: string): number {
  const d   = new Date(`${dateStr}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday … 6 = Saturday
  return dow === 0 ? 7 : dow;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/schedules — create a schedule (unauthenticated / admin tool use)
// ─────────────────────────────────────────────────────────────────────────────

const createScheduleSchema = z.object({
  busId:          z.string().min(1),
  fromStationId:  z.string().min(1, "fromStationId is required"),
  toStationId:    z.string().min(1, "toStationId is required"),
  /// Time string HH:MM (for recurring) or full ISO datetime (for non-recurring)
  departureAt:    z.string().min(1, "departureAt is required"),
  price:          z.number().positive("Price must be positive"),
  isRecurring:    z.boolean().default(true),
  activeDays:     z.string().default("1,2,3,4,5,6,7"),
});

export async function POST(req: NextRequest) {
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

    const [bus, fromStation, toStation] = await Promise.all([
      db.bus.findUnique({ where: { id: busId } }),
      db.busStation.findUnique({ where: { id: fromStationId } }),
      db.busStation.findUnique({ where: { id: toStationId } }),
    ]);

    if (!bus) {
      return NextResponse.json({ error: `No bus found with busId "${busId}".` }, { status: 404 });
    }
    if (!fromStation) {
      return NextResponse.json({ error: `No station found with fromStationId "${fromStationId}".` }, { status: 404 });
    }
    if (!toStation) {
      return NextResponse.json({ error: `No station found with toStationId "${toStationId}".` }, { status: 404 });
    }

    // Build stored departureAt value
    let storedDepartureAt: Date;
    if (isRecurring) {
      // Store only the time — use 1970-01-01 as the placeholder date
      const timePart = departureAt.includes("T") ? departureAt.split("T")[1].slice(0, 5) : departureAt.slice(0, 5);
      storedDepartureAt = new Date(`1970-01-01T${timePart}:00.000Z`);
    } else {
      storedDepartureAt = new Date(departureAt);
      if (isNaN(storedDepartureAt.getTime())) {
        return NextResponse.json({ error: "departureAt must be a valid ISO datetime for non-recurring schedules." }, { status: 400 });
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

    return NextResponse.json({ message: "Schedule created successfully.", schedule }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/schedules]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/schedules — passenger search
// Query params: fromStationId, toStationId, date (YYYY-MM-DD)
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromStationId = searchParams.get("fromStationId") ?? undefined;
    const toStationId   = searchParams.get("toStationId")   ?? undefined;
    const date          = searchParams.get("date");

    const resolvedDate = date ?? new Date().toISOString().slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(resolvedDate)) {
      return NextResponse.json(
        { error: "Query parameter 'date' must be in YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    const dayOfWeek = getActiveDayNumber(resolvedDate);

    // Fetch active schedules matching the stations
    const schedules = await db.schedule.findMany({
      where: {
        isActive: true,
        ...(fromStationId ? { fromStationId } : {}),
        ...(toStationId   ? { toStationId }   : {}),
      },
      include: {
        bus:         { include: { owner: { select: { name: true } } } },
        fromStation: { select: { id: true, name: true, district: true } },
        toStation:   { select: { id: true, name: true, district: true } },
        _count:      { select: { bookings: true } }, // will filter below
      },
      orderBy: { departureAt: "asc" },
    });

    // Filter by day-of-week (recurring) or exact date (non-recurring)
    const journeyDate = new Date(`${resolvedDate}T00:00:00.000Z`);

    const filtered = schedules.filter((s) => {
      if (s.isRecurring) {
        const days = s.activeDays.split(",").map(Number);
        return days.includes(dayOfWeek);
      }
      // Non-recurring: check departureAt date matches the journey date
      const depDate = new Date(s.departureAt).toISOString().slice(0, 10);
      return depDate === resolvedDate;
    });

    // For each schedule, count bookings for this specific journey date
    const results = await Promise.all(
      filtered.map(async (s) => {
        const bookedCount = await db.booking.count({
          where: {
            scheduleId:  s.id,
            journeyDate,
            status:      { in: ["CONFIRMED", "PENDING"] },
          },
        });

        // Departure time display
        const depTime = s.departureAt.toLocaleString("en-LK", {
          timeZone:  "Asia/Colombo",
          hour:      "2-digit",
          minute:    "2-digit",
          hour12:    true,
        });

        return {
          id:                s.id,
          fromStation:       s.fromStation,
          toStation:         s.toStation,
          departureTime:     depTime,
          price:             Number(s.price),
          isRecurring:       s.isRecurring,
          activeDays:        s.activeDays,
          seatSelectionMode: s.seatSelectionMode,
          busName:           s.bus.name,
          busType:           s.bus.busType,
          registrationNumber: s.bus.registrationNumber,
          ownerName:         s.bus.owner.name,
          totalSeats:        s.bus.totalSeats,
          availableSeats:    s.bus.totalSeats - bookedCount,
        };
      })
    );

    return NextResponse.json({ schedules: results });
  } catch (err) {
    console.error("[GET /api/schedules]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
