import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requireBusOwner } from "@/lib/auth-guard";

const STATUS_ORDER: Record<string, number> = { CONFIRMED: 0, PENDING: 1, CANCELLED: 2 };

export async function GET(
  _req: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  const { session, error } = await requireBusOwner();
  if (error) return error;

  const ownerId = session.user.id;

  try {
    const schedule = await db.schedule.findUnique({
      where:   { id: params.scheduleId },
      include: {
        bus:         true,
        fromStation: { select: { name: true } },
        toStation:   { select: { name: true } },
        bookings: {
          include: {
            payment:      true,
            scheduleSeat: { select: { seatLabel: true } },
          },
          orderBy: { createdAt: "asc" },
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

    const bookings = [...schedule.bookings]
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
      .map((b) => ({
        id:             b.id,
        seatLabel:      b.scheduleSeat?.seatLabel ?? null,
        journeyDate:    b.journeyDate,
        passengerName:  b.passengerName,
        passengerPhone: b.passengerPhone,
        status:         b.status,
        payment:        b.payment
          ? {
              amount:           Number(b.payment.amount),
              currency:         b.payment.currency,
              gatewayReference: b.payment.gatewayReference,
              paidAt:           b.payment.paidAt,
            }
          : null,
        createdAt: b.createdAt,
      }));

    return NextResponse.json({
      schedule: {
        id:          schedule.id,
        from:        schedule.fromStation.name,
        to:          schedule.toStation.name,
        departureAt: schedule.departureAt,
        price:       Number(schedule.price),
        isRecurring: schedule.isRecurring,
        isActive:    schedule.isActive,
      },
      bookings,
    });
  } catch (err) {
    console.error("[GET /api/portal/schedule/:scheduleId/bookings]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
