import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import md5 from "md5";
import db from "@/lib/db";

const initiateSchema = z.object({
  bookingId: z.string().min(1, "bookingId is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const result = initiateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: z.flattenError(result.error).fieldErrors },
        { status: 400 }
      );
    }

    const { bookingId } = result.data;

    const booking = await db.booking.findUnique({
      where:   { id: bookingId },
      include: {
        schedule: {
          include: {
            fromStation: { select: { name: true } },
            toStation:   { select: { name: true } },
          },
        },
        scheduleSeat: { select: { seatLabel: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: `No booking found with bookingId "${bookingId}".` }, { status: 404 });
    }

    if (booking.status === "CONFIRMED") {
      return NextResponse.json({ error: "This booking is already confirmed and paid." }, { status: 400 });
    }

    if (booking.status === "CANCELLED") {
      return NextResponse.json({ error: "This booking has been cancelled." }, { status: 400 });
    }

    const merchantId     = process.env.PAYHERE_MERCHANT_ID!;
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET!;
    const baseUrl        = process.env.NEXT_PUBLIC_BASE_URL!;

    const { schedule } = booking;
    const amount   = Number(schedule.price).toFixed(2);
    const currency = "LKR";

    const secretHash = md5(merchantSecret).toUpperCase();
    const hash       = md5(merchantId + bookingId + amount + currency + secretHash).toUpperCase();

    const seatInfo    = booking.scheduleSeat?.seatLabel ?? "No seat assigned";
    const journeyDateDisplay = booking.journeyDate.toLocaleDateString("en-LK", {
      timeZone: "Asia/Colombo", year: "numeric", month: "short", day: "numeric",
    });
    const depTimeDisplay = schedule.departureAt.toLocaleString("en-LK", {
      timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit", hour12: true,
    });

    const routeDescription = `${schedule.fromStation.name} → ${schedule.toStation.name} | ${seatInfo} | ${journeyDateDisplay} ${depTimeDisplay}`;

    const paymentObject = {
      sandbox:     true,
      merchant_id: merchantId,
      return_url:  `${baseUrl}/booking/success`,
      cancel_url:  `${baseUrl}/booking/cancel`,
      notify_url:  `${baseUrl}/api/payment/webhook`,
      order_id:    bookingId,
      items:       routeDescription,
      amount,
      currency,
      hash,
      first_name:  booking.passengerName,
      last_name:   "",
      email:       booking.passengerEmail ?? "",
      phone:       booking.passengerPhone,
      address:     "",
      city:        "",
      country:     "Sri Lanka",
    };

    return NextResponse.json({ payment: paymentObject });
  } catch (err) {
    console.error("[POST /api/payment/initiate]", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
