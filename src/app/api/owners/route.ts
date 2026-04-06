import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";

const createOwnerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Must be a valid email address").optional(),
  phone: z
    .string()
    .regex(/^94\d{9}$/, "Phone must be in Sri Lanka format: 94xxxxxxxxx (11 digits, no + or spaces)"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = createOwnerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: z.flattenError(result.error).fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, phone } = result.data;

    const owner = await db.busOwner.create({
      data: { name, email, phone },
    });

    return NextResponse.json(
      {
        message:
          "Bus owner registered successfully. Save this ownerId — you will need it to access your portal and add buses.",
        owner,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "P2002"
    ) {
      const target = (err as { meta?: { target?: string[] } }).meta?.target;
      if (target?.includes("phone")) {
        return NextResponse.json(
          { error: "A bus owner with this phone number is already registered." },
          { status: 409 }
        );
      }
      if (target?.includes("email")) {
        return NextResponse.json(
          { error: "A bus owner with this email address is already registered." },
          { status: 409 }
        );
      }
    }
    console.error("[POST /api/owners]", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
