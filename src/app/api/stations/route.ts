import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// Public — no auth required.
// Returns all active bus stations ordered by name.
// Supports ?search= for typeahead filtering.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";

    const stations = await db.busStation.findMany({
      where: {
        isActive: true,
        ...(search
          ? {
              OR: [
                { name:      { contains: search, mode: "insensitive" } },
                { nameLocal: { contains: search, mode: "insensitive" } },
                { district:  { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id:        true,
        name:      true,
        nameLocal: true,
        district:  true,
        province:  true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(stations);
  } catch (err) {
    console.error("[GET /api/stations]", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
