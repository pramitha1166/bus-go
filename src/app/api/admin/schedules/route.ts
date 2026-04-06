import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

const querySchema = z.object({
  date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").optional(),
  busId:    z.string().optional(),
  upcoming: z.string().optional(),
  page:     z.coerce.number().int().positive().optional().default(1),
  limit:    z.coerce.number().int().positive().max(100).optional().default(50),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    date:     searchParams.get("date")     ?? undefined,
    busId:    searchParams.get("busId")    ?? undefined,
    upcoming: searchParams.get("upcoming") ?? undefined,
    page:     searchParams.get("page")     ?? undefined,
    limit:    searchParams.get("limit")    ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fields: z.flattenError(parsed.error).fieldErrors },
      { status: 400 }
    );
  }

  const { busId, upcoming, page, limit } = parsed.data;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (busId) where.busId = busId;
    if (upcoming === "true") where.departureAt = { gt: new Date() };

    const skip = (page - 1) * limit;

    const [schedules, total] = await Promise.all([
      db.schedule.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { departureAt: "desc" },
        include: {
          bus: {
            include: { owner: { select: { name: true } } },
          },
          fromStation: { select: { name: true } },
          toStation:   { select: { name: true } },
          bookings: {
            include: { payment: { select: { amount: true } } },
          },
        },
      }),
      db.schedule.count({ where }),
    ]);

    const data = schedules.map((s) => {
      const confirmed = s.bookings.filter((b) => b.status === "CONFIRMED");
      const pending   = s.bookings.filter((b) => b.status === "PENDING");
      const revenue   = confirmed.reduce(
        (sum, b) => sum + (b.payment ? Number(b.payment.amount) : 0), 0
      );

      return {
        id:                  s.id,
        from:                s.fromStation.name,
        to:                  s.toStation.name,
        departureAt:         s.departureAt,
        price:               Number(s.price),
        isRecurring:         s.isRecurring,
        isActive:            s.isActive,
        activeDays:          s.activeDays,
        seatSelectionMode:   s.seatSelectionMode,
        smsNotificationSent: s.smsNotificationSent,
        bus: {
          id:    s.bus.id,
          name:  s.bus.name,
          owner: s.bus.owner.name,
        },
        confirmedBookings: confirmed.length,
        pendingBookings:   pending.length,
        availableSeats:    s.bus.totalSeats - confirmed.length - pending.length,
        revenue,
      };
    });

    return NextResponse.json({ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error("[GET /api/admin/schedules]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
