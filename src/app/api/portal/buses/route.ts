import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { requireBusOwner } from "@/lib/auth-guard";
import { calculateTotalSeats } from "@/lib/seatLayout";
import { BusType } from "@/lib/seatLayout";

const createBusSchema = z.object({
  name:      z.string().min(1, "Bus name is required"),
  regNumber: z.string().min(1, "Registration number is required"),
  busType:   z.enum(["NORMAL", "SEMI_LUXURY", "LUXURY", "EXPRESSWAY"], {
    error: "busType must be one of: NORMAL, SEMI_LUXURY, LUXURY, EXPRESSWAY",
  }),
  rows: z.number().int().min(5, "rows must be at least 5").max(20, "rows must be at most 20"),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireBusOwner();
  if (error) return error;

  const ownerId = session.user.id;

  try {
    const body   = await req.json();
    const result = createBusSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: z.flattenError(result.error).fieldErrors },
        { status: 400 }
      );
    }

    const { name, regNumber, busType, rows } = result.data;

    const existing = await db.bus.findFirst({ where: { registrationNumber: regNumber } });
    if (existing) {
      return NextResponse.json(
        { error: "A bus with this registration number is already registered." },
        { status: 409 }
      );
    }

    const totalSeats = calculateTotalSeats(busType as BusType, rows);

    const bus = await db.bus.create({
      data: { ownerId, name, registrationNumber: regNumber, busType: busType as BusType, rows, totalSeats },
    });

    return NextResponse.json({ bus: { ...bus, totalSeats } }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/portal/buses]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
