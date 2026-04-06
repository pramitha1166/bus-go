import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { generateDailyReport, DailyBookingRow } from "@/lib/excel";
import { requireAdmin } from "@/lib/auth-guard";

const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const querySchema = z.object({
  date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").optional(),
  status:  z.enum(["PENDING", "CONFIRMED", "CANCELLED"]).optional(),
  busId:   z.string().optional(),
  ownerId: z.string().optional(),
  search:  z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    date:    searchParams.get("date")    ?? undefined,
    status:  searchParams.get("status")  ?? undefined,
    busId:   searchParams.get("busId")   ?? undefined,
    ownerId: searchParams.get("ownerId") ?? undefined,
    search:  searchParams.get("search")  ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fields: z.flattenError(parsed.error).fieldErrors },
      { status: 400 }
    );
  }

  const { date, status, busId, ownerId, search } = parsed.data;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { passengerName:  { contains: search, mode: "insensitive" } },
        { passengerPhone: { contains: search } },
      ];
    }

    const scheduleWhere: Record<string, unknown> = {};
    if (busId)   scheduleWhere.busId = busId;
    if (ownerId) scheduleWhere.bus   = { ownerId };
    if (date)    where.journeyDate   = new Date(`${date}T00:00:00.000Z`);
    if (Object.keys(scheduleWhere).length > 0) where.schedule = scheduleWhere;

    const bookings = await db.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
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
    });

    if (bookings.length === 0) {
      return NextResponse.json({ error: "No bookings found for the selected filters." }, { status: 400 });
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

    const slToday    = new Date(Date.now() + SL_OFFSET_MS).toISOString().slice(0, 10);
    const reportDate = date ?? slToday;
    const buffer     = await generateDailyReport(rows, reportDate);
    const filename   = `bookings-export-${reportDate}.xlsx`;

    return new NextResponse(buffer, {
      status:  200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/bookings/export]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
