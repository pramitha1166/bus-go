import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

const querySchema = z.object({
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

  const { ownerId, search, page, limit } = parsed.data;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (ownerId) where.ownerId = ownerId;
    if (search) {
      where.OR = [
        { name:               { contains: search, mode: "insensitive" } },
        { registrationNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [buses, total] = await Promise.all([
      db.bus.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { createdAt: "desc" },
        include: {
          owner: { select: { name: true, phone: true } },
          schedules: {
            include: {
              bookings: { include: { payment: { select: { amount: true } } } },
            },
          },
        },
      }),
      db.bus.count({ where }),
    ]);

    const data = buses.map((bus) => {
      const allBookings       = bus.schedules.flatMap((s) => s.bookings);
      const confirmedBookings = allBookings.filter((b) => b.status === "CONFIRMED");
      const totalRevenue      = confirmedBookings.reduce(
        (sum, b) => sum + (b.payment ? Number(b.payment.amount) : 0), 0
      );

      return {
        id:           bus.id,
        name:         bus.name,
        regNumber:    bus.registrationNumber,
        busType:      bus.busType,
        rows:         bus.rows,
        totalSeats:   bus.totalSeats,
        createdAt:    bus.createdAt,
        owner:        { name: bus.owner.name, phone: bus.owner.phone },
        stats: {
          totalSchedules:         bus.schedules.length,
          totalConfirmedBookings: confirmedBookings.length,
          totalRevenue,
        },
      };
    });

    return NextResponse.json({ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error("[GET /api/admin/buses]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
