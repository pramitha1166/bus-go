import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

const querySchema = z.object({
  search: z.string().optional(),
  page:   z.coerce.number().int().positive().optional().default(1),
  limit:  z.coerce.number().int().positive().max(100).optional().default(50),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    search: searchParams.get("search") ?? undefined,
    page:   searchParams.get("page")   ?? undefined,
    limit:  searchParams.get("limit")  ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { search, page, limit } = parsed.data;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = search
      ? {
          OR: [
            { name:  { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
          ],
        }
      : {};

    const skip = (page - 1) * limit;

    const [owners, total] = await Promise.all([
      db.busOwner.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { createdAt: "desc" },
        include: {
          buses: {
            include: {
              schedules: {
                include: {
                  bookings: {
                    include: { payment: { select: { amount: true } } },
                  },
                },
              },
            },
          },
        },
      }),
      db.busOwner.count({ where }),
    ]);

    const data = owners.map((owner) => {
      const allBookings = owner.buses.flatMap((b) =>
        b.schedules.flatMap((s) => s.bookings)
      );
      const confirmedBookings = allBookings.filter((b) => b.status === "CONFIRMED");
      const totalRevenue      = confirmedBookings.reduce(
        (sum, b) => sum + (b.payment ? Number(b.payment.amount) : 0),
        0
      );

      // Most recent booking across all buses
      const sorted         = [...allBookings].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      const lastActivityAt = sorted[0]?.createdAt ?? null;

      return {
        id:                     owner.id,
        name:                   owner.name,
        email:                  owner.email,
        phone:                  owner.phone,
        isActive:               owner.isActive,
        createdAt:              owner.createdAt,
        stats: {
          totalBuses:              owner.buses.length,
          totalSchedules:          owner.buses.reduce((n, b) => n + b.schedules.length, 0),
          totalConfirmedBookings:  confirmedBookings.length,
          totalRevenue,
          lastActivityAt,
        },
      };
    });

    return NextResponse.json({
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/owners]", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
