import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const owner = await db.busOwner.findUnique({
      where: { id: params.id },
      include: {
        buses: {
          include: {
            schedules: true,
          },
        },
      },
    });

    if (!owner) {
      return NextResponse.json(
        { error: `No bus owner found with ownerId "${params.id}".` },
        { status: 404 }
      );
    }

    return NextResponse.json({ owner });
  } catch (err) {
    console.error("[GET /api/owners/:id]", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
