import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { generateSeatLayout } from "@/lib/seatLayout";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const journeyDateParam = searchParams.get("journeyDate");

    if (!journeyDateParam || !/^\d{4}-\d{2}-\d{2}$/.test(journeyDateParam)) {
      return NextResponse.json(
        { error: "Query parameter 'journeyDate' is required and must be in YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    const schedule = await db.schedule.findUnique({
      where: { id: params.id },
      include: {
        bus: { select: { busType: true, rows: true, totalSeats: true } },
      },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: `No schedule found with scheduleId "${params.id}".` },
        { status: 404 }
      );
    }

    const journeyDate = new Date(`${journeyDateParam}T00:00:00.000Z`);

    // Fetch all ScheduleSeat records for this journey date
    const scheduleSeats = await db.scheduleSeat.findMany({
      where:   { scheduleId: params.id, journeyDate },
      include: { booking: { select: { status: true } } },
    });

    // Build a map: seatLabel → { isDisabled, bookingStatus }
    const seatStatusMap = new Map<
      string,
      { isDisabled: boolean; bookingStatus?: string }
    >();
    for (const ss of scheduleSeats) {
      seatStatusMap.set(ss.seatLabel, {
        isDisabled:    ss.isDisabled,
        bookingStatus: ss.booking?.status,
      });
    }

    // Generate layout
    const layout = generateSeatLayout(schedule.bus.busType, schedule.bus.rows);

    // Annotate each seat with its live status
    const rows = layout.rows.map((row) => ({
      ...row,
      seats: row.seats.map((seat) => {
        const state = seatStatusMap.get(seat.label);
        let status: "available" | "confirmed" | "pending" | "disabled" = "available";

        if (state?.isDisabled) {
          status = "disabled";
        } else if (state?.bookingStatus === "CONFIRMED") {
          status = "confirmed";
        } else if (state?.bookingStatus === "PENDING") {
          status = "pending";
        }

        return { ...seat, status };
      }),
    }));

    return NextResponse.json({
      scheduleId:        params.id,
      journeyDate:       journeyDateParam,
      seatSelectionMode: layout.seatSelectionMode,
      totalSeats:        layout.totalSeats,
      seatsPerRow:       layout.seatsPerRow,
      rows,
    });
  } catch (err) {
    console.error("[GET /api/schedules/:id/seats]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
