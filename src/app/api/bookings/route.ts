import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { format, getISODay } from "date-fns";
import db from "@/lib/db";
import { sendSMS } from "@/lib/sms";

// Day-of-week where 1=Monday … 7=Sunday
function getDayNumber(date: Date): number {
  const dow = date.getUTCDay();
  return dow === 0 ? 7 : dow;
}

const createBookingSchema = z.object({
  scheduleId:    z.string().min(1, "scheduleId is required"),
  journeyDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "journeyDate must be YYYY-MM-DD"),
  /// Required for OPTIONAL and REQUIRED mode buses; omit for NONE mode.
  seatLabel:     z.string().optional(),
  passengerName:  z.string().min(1, "Passenger name is required"),
  passengerPhone: z
    .string()
    .regex(/^94\d{9}$/, "Phone must be in Sri Lanka format: 94xxxxxxxxx"),
  passengerEmail: z.string().email("Must be a valid email address").optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const result = createBookingSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: z.flattenError(result.error).fieldErrors },
        { status: 400 }
      );
    }

    const { scheduleId, journeyDate: journeyDateStr, seatLabel, passengerName, passengerPhone, passengerEmail } =
      result.data;

    const journeyDate = new Date(`${journeyDateStr}T00:00:00.000Z`);

    // 1. Fetch schedule
    const schedule = await db.schedule.findUnique({
      where:   { id: scheduleId },
      include: {
        bus:         { select: { name: true, busType: true } },
        fromStation: { select: { name: true } },
        toStation:   { select: { name: true } },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: `No schedule found with scheduleId "${scheduleId}".` }, { status: 404 });
    }

    // 2. Check schedule is active
    if (!schedule.isActive) {
      return NextResponse.json({ error: "This schedule is currently inactive." }, { status: 400 });
    }

    // 3. Validate journey date
    if (schedule.isRecurring) {
      const dayOfWeek = getISODay(journeyDate);
      const activeDays = schedule.activeDays.split(",").map(Number);
      if (!activeDays.includes(dayOfWeek)) {
        return NextResponse.json(
          { error: `This schedule does not run on the selected date.` },
          { status: 400 }
        );
      }
    } else {
      // Non-recurring: journeyDate must match departureAt date
      const scheduleDate = schedule.departureAt ? format(new Date(schedule.departureAt), 'yyyy-MM-dd') : null;
      if (scheduleDate !== journeyDateStr) {
        return NextResponse.json(
          { error: "Journey date does not match this one-off schedule." },
          { status: 400 }
        );
      }
    }

    const { seatSelectionMode } = schedule;

    // 4. Validate seat selection based on mode
    if (seatSelectionMode === "REQUIRED" && !seatLabel) {
      return NextResponse.json({ error: "A seat must be selected for this bus type." }, { status: 400 });
    }

    let scheduleSeatId: string | null = null;

    if (seatLabel && seatSelectionMode !== "NONE") {
      // 5a. Find or create the ScheduleSeat record
      const existingSeat = await db.scheduleSeat.findUnique({
        where: {
          scheduleId_seatLabel_journeyDate: { scheduleId, seatLabel, journeyDate },
        },
        include: { booking: true },
      });

      if (existingSeat) {
        if (existingSeat.isDisabled) {
          return NextResponse.json({ error: `Seat ${seatLabel} is disabled for this journey.` }, { status: 409 });
        }
        if (existingSeat.booking && ["CONFIRMED", "PENDING"].includes(existingSeat.booking.status)) {
          return NextResponse.json({ error: `Seat ${seatLabel} is already booked.` }, { status: 409 });
        }
        scheduleSeatId = existingSeat.id;
      } else {
        // Create a new ScheduleSeat record
        const newSeat = await db.scheduleSeat.create({
          data: { scheduleId, seatLabel, journeyDate },
        });
        scheduleSeatId = newSeat.id;
      }
    }

    // 6. Create the booking
    let booking;
    try {
      booking = await db.booking.create({
        data: {
          scheduleId,
          scheduleSeatId,
          journeyDate,
          passengerName,
          passengerPhone,
          passengerEmail,
          status: "PENDING",
        },
      });
    } catch (createErr: unknown) {
      if (
        createErr &&
        typeof createErr === "object" &&
        "code" in createErr &&
        createErr.code === "P2002"
      ) {
        return NextResponse.json({ error: `Seat ${seatLabel} is already booked.` }, { status: 409 });
      }
      throw createErr;
    }

    // 7. Send pending SMS — fire-and-forget
    const seatInfo = seatLabel ? `seat ${seatLabel}` : "a seat";
    const journeyDateDisplay = journeyDate.toLocaleDateString("en-LK", {
      timeZone: "Asia/Colombo", year: "numeric", month: "short", day: "numeric",
    });

    try {
      await sendSMS(
        passengerPhone,
        `Hi ${passengerName}, your ${seatInfo} on ${schedule.fromStation.name} → ${schedule.toStation.name} on ${journeyDateDisplay} is reserved. Complete payment within 15 minutes or your seat will be released.`
      );
    } catch (smsErr) {
      console.error("[POST /api/bookings] SMS failed (non-fatal):", smsErr);
    }

    return NextResponse.json(
      { message: "Seat reserved. Complete payment within 15 minutes to confirm your booking.", booking },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/bookings]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam   = searchParams.get("date");
    const busId       = searchParams.get("busId");
    const statusParam = searchParams.get("status");

    const validStatuses = ["PENDING", "CONFIRMED", "CANCELLED"] as const;
    if (statusParam && !validStatuses.includes(statusParam as (typeof validStatuses)[number])) {
      return NextResponse.json({ error: "status must be one of: PENDING, CONFIRMED, CANCELLED" }, { status: 400 });
    }

    if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json({ error: "date must be in YYYY-MM-DD format." }, { status: 400 });
    }

    const resolvedDate = dateParam ?? new Date().toISOString().slice(0, 10);
    const journeyDate  = new Date(`${resolvedDate}T00:00:00.000Z`);

    const bookings = await db.booking.findMany({
      where: {
        journeyDate,
        ...(statusParam && { status: statusParam as (typeof validStatuses)[number] }),
        schedule: busId ? { busId } : undefined,
      },
      include: {
        schedule: {
          include: {
            bus:         { select: { name: true, registrationNumber: true } },
            fromStation: { select: { name: true } },
            toStation:   { select: { name: true } },
          },
        },
        scheduleSeat: { select: { seatLabel: true } },
        payment:      true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ bookings });
  } catch (err) {
    console.error("[GET /api/bookings]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
