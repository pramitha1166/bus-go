import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const booking = await db.booking.findUnique({
      where:   { id: params.id },
      include: {
        schedule: {
          include: {
            bus:         { include: { owner: true } },
            fromStation: { select: { name: true } },
            toStation:   { select: { name: true } },
          },
        },
        scheduleSeat: { select: { seatLabel: true } },
        payment:      true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: `No booking found with bookingId "${params.id}".` },
        { status: 404 }
      );
    }

    return NextResponse.json({ booking });
  } catch (err) {
    console.error("[GET /api/bookings/:id]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
