import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { createOTP } from "@/lib/otp";
import { sendOtpCode } from "@/lib/sms";

const bodySchema = z.object({
  phone: z
    .string()
    .regex(
      /^94\d{9}$/,
      "Phone must be in Sri Lanka format: 94xxxxxxxxx (11 digits, no + or spaces)"
    ),
  role: z.enum(["BUS_OWNER", "ADMIN"], {
    error: "role must be BUS_OWNER or ADMIN",
  }),
});

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const result = bodySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: z.flattenError(result.error).fieldErrors },
        { status: 400 }
      );
    }

    const { phone, role } = result.data;

    // ── Verify the phone belongs to a registered account ─────────────────────
    if (role === "BUS_OWNER") {
      const owner = await db.busOwner.findUnique({ where: { phone } });
      if (!owner) {
        return NextResponse.json(
          {
            error:
              "No bus owner account found with this phone number. Please register first.",
          },
          { status: 404 }
        );
      }
    } else {
      const admin = await db.admin.findUnique({ where: { phone } });
      if (!admin) {
        return NextResponse.json(
          { error: "No admin account found with this phone number." },
          { status: 404 }
        );
      }
    }

    // ── Rate limit — one active OTP at a time per phone+role ──────────────────
    const existing = await db.otpCode.findFirst({
      where: {
        phone,
        role,
        used:      false,
        expiresAt: { gt: new Date() },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An OTP was already sent. Please wait before requesting a new one." },
        { status: 429 }
      );
    }

    // ── Generate OTP and persist (hashed) ────────────────────────────────────
    const code = await createOTP(phone, role);

    // ── Send SMS — throws on failure ──────────────────────────────────────────
    try {
      await sendOtpCode(phone, code);
    } catch (smsErr) {
      console.error("[POST /api/auth/send-otp] SMS delivery failed:", smsErr);
      return NextResponse.json(
        { error: "Failed to send OTP. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "OTP sent successfully." });
  } catch (err) {
    console.error("[POST /api/auth/send-otp]", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
