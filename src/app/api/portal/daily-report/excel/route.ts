import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { generateDailyReport, DailyBookingRow } from "@/lib/excel";
import { requireBusOwner } from "@/lib/auth-guard";

const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format").optional(),
});

export async function GET(req: NextRequest) {
  const { session, error } = await requireBusOwner();
  if (error) return error;

  const ownerId = session.user.id;

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({ date: searchParams.get("date") ?? undefined });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fields: z.flattenError(parsed.error).fieldErrors },
      { status: 400 }
    );
  }

  const { date } = parsed.data;

  try {
    const slDateStr = date ?? new Date(Date.now() + SL_OFFSET_MS).toISOString().slice(0, 10);
    const startUTC  = new Date(`${slDateStr}T00:00:00.000Z`);
    startUTC.setTime(startUTC.getTime() - SL_OFFSET_MS);
    const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);

    const bookings = await db.booking.findMany({
      where: {
        createdAt: { gte: startUTC, lt: endUTC },
        schedule:  { bus: { ownerId } },
      },
      include: {
        schedule: {
          include: {
            bus:         true,
            fromStation: { select: { name: true } },
            toStation:   { select: { name: true } },
          },
        },
        scheduleSeat: { select: { seatLabel: true } },
        payment:      true,
      },
      orderBy: [{ journeyDate: "asc" }, { createdAt: "asc" }],
    });

    if (bookings.length === 0) {
      return NextResponse.json({ error: "No bookings found for this date." }, { status: 400 });
    }

    const rows: DailyBookingRow[] = bookings.map((b) => ({
      seatLabel:      b.scheduleSeat?.seatLabel ?? null,
      passengerName:  b.passengerName,
      passengerPhone: b.passengerPhone,
      busName:        b.schedule.bus.name,
      route:          `${b.schedule.fromStation.name} → ${b.schedule.toStation.name}`,
      departureTime:  b.schedule.departureAt,
      bookingStatus:  b.status,
      paymentAmount:  b.payment ? Number(b.payment.amount) : null,
      paymentRef:     b.payment?.gatewayReference ?? null,
      journeyDate:    b.journeyDate,
    }));

    const buffer   = await generateDailyReport(rows, slDateStr);
    const filename = `daily-report-${ownerId}-${slDateStr}.xlsx`;

    return new NextResponse(buffer, {
      status:  200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/portal/daily-report/excel]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
