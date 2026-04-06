import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { sendSMSStrict } from "@/lib/sms";
import { requireAdmin } from "@/lib/auth-guard";

const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const BATCH_SIZE   = 10;
const BATCH_DELAY  = 1000; // ms between batches

const bodySchema = z.discriminatedUnion("target", [
  z.object({
    target:  z.literal("all-owners"),
    message: z.string().min(1).max(160, "Message must be 160 characters or less"),
  }),
  z.object({
    target:  z.literal("all-passengers-today"),
    message: z.string().min(1).max(160, "Message must be 160 characters or less"),
  }),
  z.object({
    target:  z.literal("specific-phones"),
    message: z.string().min(1).max(160, "Message must be 160 characters or less"),
    phones:  z
      .array(
        z.string().regex(/^94\d{9}$/, "Each phone must be in Sri Lanka format: 94xxxxxxxxx")
      )
      .min(1, "phones must contain at least one number")
      .max(50, "phones must contain 50 or fewer numbers"),
  }),
]);

// Send SMS to all phones in batches of BATCH_SIZE with a 1-second delay between batches.
// Each individual failure is caught so the rest of the batch continues.
async function sendInBatches(
  phones: string[],
  message: string
): Promise<{ sent: number; failed: number; total: number }> {
  let sent   = 0;
  let failed = 0;

  for (let i = 0; i < phones.length; i += BATCH_SIZE) {
    const batch   = phones.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (phone) => {
        try {
          await sendSMSStrict(phone, message);
          return "sent" as const;
        } catch (err) {
          console.error(`[broadcast] SMS failed to ${phone}:`, err);
          return "failed" as const;
        }
      })
    );

    sent   += results.filter((r) => r === "sent").length;
    failed += results.filter((r) => r === "failed").length;

    // Delay between batches (skip after the last batch)
    if (i + BATCH_SIZE < phones.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
    }
  }

  return { sent, failed, total: phones.length };
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body   = await req.json();
    const result = bodySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: z.flattenError(result.error).fieldErrors },
        { status: 400 }
      );
    }

    const { target, message } = result.data;

    let phones: string[] = [];

    if (target === "all-owners") {
      const owners = await db.busOwner.findMany({
        where:  { isActive: true },
        select: { phone: true },
      });
      phones = owners.map((o) => o.phone);
    } else if (target === "all-passengers-today") {
      // Today's UTC range in SL timezone
      const nowSL       = new Date(Date.now() + SL_OFFSET_MS);
      const todayStr    = nowSL.toISOString().slice(0, 10);
      const todayStart  = new Date(`${todayStr}T00:00:00.000Z`);
      todayStart.setTime(todayStart.getTime() - SL_OFFSET_MS);
      const todayEnd    = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      const bookings = await db.booking.findMany({
        where: {
          status:    "CONFIRMED",
          createdAt: { gte: todayStart, lt: todayEnd },
        },
        select: { passengerPhone: true },
        distinct: ["passengerPhone"],
      });
      phones = bookings.map((b) => b.passengerPhone);
    } else {
      // target === "specific-phones"
      phones = (result.data as { phones: string[] }).phones;
    }

    if (phones.length === 0) {
      return NextResponse.json(
        { error: "No recipients found for the selected target." },
        { status: 400 }
      );
    }

    const stats = await sendInBatches(phones, message);

    return NextResponse.json(stats);
  } catch (err) {
    console.error("[POST /api/admin/sms/broadcast]", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
