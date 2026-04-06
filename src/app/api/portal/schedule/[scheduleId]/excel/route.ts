import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { generateSeatSheet, BookingRow, ScheduleInfo } from "@/lib/excel";
import { requireBusOwner } from "@/lib/auth-guard";

const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

export async function GET(
  req: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  const { session, error } = await requireBusOwner();
  if (error) return error;

  const ownerId = session.user.id;

  try {
    const { searchParams } = new URL(req.url);
    const journeyDateParam = searchParams.get("journeyDate");

    if (!journeyDateParam || !/^\d{4}-\d{2}-\d{2}$/.test(journeyDateParam)) {
      return NextResponse.json(
        { error: "Query parameter 'journeyDate' is required (YYYY-MM-DD)." },
        { status: 400 }
      );
    }

    const journeyDate = new Date(`${journeyDateParam}T00:00:00.000Z`);

    const schedule = await db.schedule.findUnique({
      where:   { id: params.scheduleId },
      include: {
        bus:         true,
        fromStation: { select: { name: true } },
        toStation:   { select: { name: true } },
        bookings: {
          where:   { status: "CONFIRMED", journeyDate },
          include: { payment: true, scheduleSeat: { select: { seatLabel: true } } },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: `No schedule found with scheduleId "${params.scheduleId}".` },
        { status: 404 }
      );
    }

    if (schedule.bus.ownerId !== ownerId) {
      return NextResponse.json({ error: "You do not have access to this schedule." }, { status: 403 });
    }

    const journeyDateDisplay = journeyDate.toLocaleDateString("en-LK", {
      timeZone: "Asia/Colombo", year: "numeric", month: "short", day: "numeric",
    });

    const bookingRows: BookingRow[] = schedule.bookings.map((b) => ({
      seatLabel:      b.scheduleSeat?.seatLabel ?? null,
      passengerName:  b.passengerName,
      passengerPhone: b.passengerPhone,
      bookingStatus:  b.status,
      paymentStatus:  b.payment ? "PAID" : "UNPAID",
      paymentRef:     b.payment?.gatewayReference ?? null,
      bookedAt:       b.createdAt,
      journeyDate:    b.journeyDate,
    }));

    const scheduleInfo: ScheduleInfo = {
      from:        schedule.fromStation.name,
      to:          schedule.toStation.name,
      totalSeats:  schedule.bus.totalSeats,
      busType:     schedule.bus.busType,
      journeyDate: journeyDateDisplay,
    };

    const buffer   = await generateSeatSheet(bookingRows, scheduleInfo);
    const filename = `seat-sheet-${schedule.fromStation.name}-${schedule.toStation.name}-${journeyDateParam}.xlsx`;

    return new NextResponse(buffer, {
      status:  200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/portal/schedule/:scheduleId/excel]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
