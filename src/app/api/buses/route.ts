import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { calculateTotalSeats } from "@/lib/seatLayout";
import { BusType } from "@/lib/seatLayout";

const createBusSchema = z.object({
  ownerId:   z.string().min(1, "ownerId is required"),
  name:      z.string().min(1, "Bus name is required"),
  regNumber: z.string().min(1, "Registration number is required"),
  busType:   z.enum(["NORMAL", "SEMI_LUXURY", "LUXURY", "EXPRESSWAY"], {
    error: "busType must be one of: NORMAL, SEMI_LUXURY, LUXURY, EXPRESSWAY",
  }),
  rows: z.number().int().min(5, "rows must be at least 5").max(20, "rows must be at most 20"),
});

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const result = createBusSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: z.flattenError(result.error).fieldErrors },
        { status: 400 }
      );
    }

    const { ownerId, name, regNumber, busType, rows } = result.data;

    const owner = await db.busOwner.findUnique({ where: { id: ownerId } });
    if (!owner) {
      return NextResponse.json(
        { error: `No bus owner found with ownerId "${ownerId}". Register the owner first via POST /api/owners.` },
        { status: 404 }
      );
    }

    const existing = await db.bus.findFirst({ where: { registrationNumber: regNumber } });
    if (existing) {
      return NextResponse.json(
        { error: `A bus with registration number "${regNumber}" is already registered.` },
        { status: 409 }
      );
    }

    const totalSeats = calculateTotalSeats(busType as BusType, rows);

    const bus = await db.bus.create({
      data: { ownerId, name, registrationNumber: regNumber, busType: busType as BusType, rows, totalSeats },
    });

    return NextResponse.json(
      { message: "Bus registered successfully.", bus: { ...bus, totalSeats } },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/buses]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get("ownerId");

    if (!ownerId) {
      return NextResponse.json(
        { error: "Query parameter 'ownerId' is required." },
        { status: 400 }
      );
    }

    const buses = await db.bus.findMany({
      where: { ownerId },
      include: {
        schedules: {
          include: {
            _count: {
              select: {
                bookings: { where: { status: "CONFIRMED" } },
              },
            },
          },
        },
      },
    });

    const shaped = buses.map((bus) => ({
      ...bus,
      schedules: bus.schedules.map(({ _count, ...schedule }) => ({
        ...schedule,
        confirmedBookings: _count.bookings,
      })),
    }));

    return NextResponse.json({ buses: shaped });
  } catch (err) {
    console.error("[GET /api/buses]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
