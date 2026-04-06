import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { generateSeatSheet, BookingRow, ScheduleInfo } from "@/lib/excel";

export async function POST(
  req: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const journeyDateParam = searchParams.get("journeyDate");

  if (!journeyDateParam || !/^\d{4}-\d{2}-\d{2}$/.test(journeyDateParam)) {
    return NextResponse.json(
      { error: "Query parameter 'journeyDate' is required (YYYY-MM-DD)." },
      { status: 400 }
    );
  }

  const journeyDate = new Date(`${journeyDateParam}T00:00:00.000Z`);

  try {
    const schedule = await db.schedule.findUnique({
      where:   { id: params.scheduleId },
      include: {
        bus:         { include: { owner: true } },
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

    const journeyDateDisplay = journeyDate.toLocaleDateString("en-LK", {
      timeZone: "Asia/Colombo", year: "numeric", month: "short", day: "numeric",
    });

    type BookingResult = typeof schedule.bookings[number];
    const bookingRows: BookingRow[] = schedule.bookings.map((b: BookingResult) => ({
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
    const filename = `seats-${params.scheduleId}-${journeyDateParam}.xlsx`;

    return new NextResponse(buffer, {
      status:  200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[POST /api/reports/schedule/:scheduleId]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
