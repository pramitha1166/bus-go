import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const querySchema = z.object({
  date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").optional(),
  status:  z.enum(["PENDING", "CONFIRMED", "CANCELLED"]).optional(),
  busId:   z.string().optional(),
  ownerId: z.string().optional(),
  search:  z.string().optional(),
  page:    z.coerce.number().int().positive().optional().default(1),
  limit:   z.coerce.number().int().positive().max(100).optional().default(50),
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
    page:    searchParams.get("page")    ?? undefined,
    limit:   searchParams.get("limit")   ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fields: z.flattenError(parsed.error).fieldErrors },
      { status: 400 }
    );
  }

  const { date, status, busId, ownerId, search, page, limit } = parsed.data;

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

    if (date) {
      const journeyDate = new Date(`${date}T00:00:00.000Z`);
      where.journeyDate = journeyDate;
    }

    if (Object.keys(scheduleWhere).length > 0) where.schedule = scheduleWhere;

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      db.booking.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { createdAt: "desc" },
        include: {
          schedule: {
            include: {
              bus:         { include: { owner: { select: { name: true } } } },
              fromStation: { select: { name: true } },
              toStation:   { select: { name: true } },
            },
          },
          scheduleSeat: { select: { seatLabel: true } },
          payment:      true,
        },
      }),
      db.booking.count({ where }),
    ]);

    const data = bookings.map((b) => ({
      id:             b.id,
      seatLabel:      b.scheduleSeat?.seatLabel ?? null,
      journeyDate:    b.journeyDate,
      passengerName:  b.passengerName,
      passengerPhone: b.passengerPhone,
      passengerEmail: b.passengerEmail,
      status:         b.status,
      schedule: {
        id:          b.schedule.id,
        from:        b.schedule.fromStation.name,
        to:          b.schedule.toStation.name,
        departureAt: b.schedule.departureAt,
        price:       Number(b.schedule.price),
      },
      bus:   { id: b.schedule.bus.id, name: b.schedule.bus.name },
      owner: { name: b.schedule.bus.owner.name },
      payment: b.payment
        ? {
            amount:           Number(b.payment.amount),
            currency:         b.payment.currency,
            gatewayReference: b.payment.gatewayReference,
            paidAt:           b.payment.paidAt,
          }
        : null,
      createdAt: b.createdAt,
    }));

    return NextResponse.json({ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error("[GET /api/admin/bookings]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
