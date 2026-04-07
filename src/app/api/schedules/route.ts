import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { getSeatSelectionMode } from "@/lib/seatLayout";
import { format, getISODay, startOfDay, endOfDay } from "date-fns"; // FIXED: added format

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/schedules — create a schedule (unauthenticated / admin tool use)
// ─────────────────────────────────────────────────────────────────────────────

const createScheduleSchema = z.object({
  busId:         z.string().min(1),
  fromStationId: z.string().min(1, "fromStationId is required"),
  toStationId:   z.string().min(1, "toStationId is required"),
  /// Time string HH:MM (for recurring) or full ISO datetime (for non-recurring)
  departureAt:   z.string().min(1, "departureAt is required"),
  price:         z.number().positive("Price must be positive"),
  isRecurring:   z.boolean().default(true),
  activeDays:    z.string().default("1,2,3,4,5,6,7"), // FIXED: 1=Mon, 7=Sun (ISO day)
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
        // FIXED: null for recurring (Prisma DateTime? accepts null to clear), Date for non-recurring
        departureAt: isRecurring ? null : new Date(departureAt),
        isRecurring,
        activeDays, // FIXED: default "1,2,3,4,5,6,7" (ISO days, 1=Mon 7=Sun)
        price,
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
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromStationId = searchParams.get("fromStationId") ?? undefined;
    const toStationId   = searchParams.get("toStationId")   ?? undefined;
    const date          = searchParams.get("date") ?? undefined;

    // Fix B — default date to today when not provided
    const searchDate    = date ? new Date(date) : new Date(); // FIXED: never undefined
    const searchDateStr = format(searchDate, "yyyy-MM-dd");   // FIXED: normalised string

    // Fix C — use getISODay consistently (1=Mon, 7=Sun)
    const dayOfWeek = getISODay(searchDate); // FIXED: 1=Monday, 7=Sunday

    // Fix A — build station filter only if provided
    const stationFilter = fromStationId && toStationId
      ? { fromStationId, toStationId }
      : fromStationId
        ? { fromStationId }
        : toStationId
          ? { toStationId }
          : {}; // FIXED: no station filter — return all

    // 1. Fetch recurring schedules
    const recurringSchedules = await db.schedule.findMany({
      where: {
        isRecurring: true,
        isActive: true,
        ...stationFilter, // FIXED: spread station filter — Bus model has no isActive field, skip that filter
      },
      include: {
        bus: { include: { owner: true } },
        fromStation: true,
        toStation: true,
        bookings: {
          where: {
            journeyDate: {
              gte: startOfDay(searchDate),
              lte: endOfDay(searchDate),
            },
            status: { in: ["CONFIRMED", "PENDING"] },
          },
        },
      },
    });

    // Fix C — filter recurring schedules by day of week using getISODay
    const matchingRecurring = recurringSchedules.filter((s) => {
      const days = s.activeDays.split(",").map((d) => parseInt(d.trim()));
      return days.includes(dayOfWeek); // FIXED: compare ISO day numbers
    });

    // 2. Fetch non-recurring schedules on the search date
    const nonRecurringSchedules = await db.schedule.findMany({
      where: {
        isRecurring: false,
        isActive: true,
        departureAt: {
          gte: startOfDay(searchDate),
          lte: endOfDay(searchDate),
        },
        ...stationFilter, // FIXED: spread station filter
      },
      include: {
        bus: { include: { owner: true } },
        fromStation: true,
        toStation: true,
        bookings: {
          where: {
            status: { in: ["CONFIRMED", "PENDING"] },
          },
        },
      },
    });

    const allSchedules = [...matchingRecurring, ...nonRecurringSchedules];

    // Fix D — debug logging (remove once confirmed working)
    console.log("[Schedule Search]", {
      searchDateStr,
      dayOfWeek,
      fromStationId: fromStationId || "not provided",
      toStationId:   toStationId   || "not provided",
      recurringFound:    recurringSchedules.length,
      matchingRecurring: matchingRecurring.length,
      nonRecurringFound: nonRecurringSchedules.length,
      total: allSchedules.length,
    });

    // Fix E — return consistent response shape
    return NextResponse.json(
      allSchedules.map((s) => ({
        id:            s.id,
        fromStation:   { id: s.fromStation.id, name: s.fromStation.name, district: s.fromStation.district },
        toStation:     { id: s.toStation.id,   name: s.toStation.name,   district: s.toStation.district },
        busName:       s.bus.name,
        busType:       s.bus.busType,
        regNumber:     s.bus.registrationNumber, // schema field is registrationNumber
        rows:          s.bus.rows,
        departureTime: s.departureTime,          // FIXED: always "HH:MM" string
        departureAt:   s.departureAt ?? null,    // FIXED: null for recurring
        isRecurring:   s.isRecurring,
        activeDays:    s.activeDays,
        price:         Number(s.price),
        totalSeats:    s.bus.totalSeats,
        availableSeats: Math.max(0, s.bus.totalSeats - s.bookings.length), // FIXED: never negative
        seatSelectionMode: s.seatSelectionMode,
        journeyDate:   searchDateStr,            // FIXED: actual travel date string
        ownerName:     s.bus.owner.name,
      }))
    );
  } catch (err) {
    console.error("[GET /api/schedules]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
