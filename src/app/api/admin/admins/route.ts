import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

const createAdminSchema = z.object({
  name:  z.string().min(1, "Name is required"),
  phone: z
    .string()
    .regex(
      /^94\d{9}$/,
      "Phone must be in Sri Lanka format: 94xxxxxxxxx (11 digits, no + or spaces)"
    ),
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/admins — list all admin accounts
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const admins = await db.admin.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id:        true,
        name:      true,
        phone:     true,
        createdAt: true,
      },
    });

    return NextResponse.json({ admins });
  } catch (err) {
    console.error("[GET /api/admin/admins]", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/admins — create a new admin account
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body   = await req.json();
    const result = createAdminSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: z.flattenError(result.error).fieldErrors },
        { status: 400 }
      );
    }

    const { name, phone } = result.data;

    const admin = await db.admin.create({ data: { name, phone } });

    return NextResponse.json({ admin }, { status: 201 });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An admin with this phone number already exists." },
        { status: 409 }
      );
    }
    console.error("[POST /api/admin/admins]", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
