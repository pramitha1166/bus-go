import { NextRequest, NextResponse } from "next/server";
import md5 from "md5";
import db from "@/lib/db";
import { sendBookingConfirmation } from "@/lib/sms";

const PAYHERE_STATUS_SUCCESS = "2";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const merchant_id      = formData.get("merchant_id")      as string;
    const order_id         = formData.get("order_id")         as string; // = bookingId
    const payment_id       = formData.get("payment_id")       as string;
    const payhere_amount   = formData.get("payhere_amount")   as string;
    const payhere_currency = formData.get("payhere_currency") as string;
    const status_code      = formData.get("status_code")      as string;
    const md5sig           = formData.get("md5sig")           as string;
    const method           = formData.get("method")           as string | null;
    const status_message   = formData.get("status_message")   as string | null;

    if (!merchant_id || !order_id || !payment_id || !payhere_amount || !payhere_currency || !status_code || !md5sig) {
      return NextResponse.json({ error: "Missing required webhook fields." }, { status: 400 });
    }

    // Verify MD5 signature
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET!;
    const secretHash     = md5(merchantSecret).toUpperCase();
    const expectedSig    = md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + secretHash).toUpperCase();

    if (md5sig !== expectedSig) {
      console.warn("[webhook] Invalid MD5 signature for order:", order_id);
      return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }

    if (status_code !== PAYHERE_STATUS_SUCCESS) {
      return NextResponse.json({ received: true, processed: false });
    }

    // Guard duplicate webhooks
    const existingPayment = await db.payment.findUnique({ where: { bookingId: order_id } });
    if (existingPayment) {
      return NextResponse.json({ received: true, processed: false, reason: "duplicate" });
    }

    const booking = await db.booking.findUnique({
      where:   { id: order_id },
      include: {
        schedule: {
          include: {
            bus:         { select: { name: true, busType: true } },
            fromStation: { select: { name: true } },
            toStation:   { select: { name: true } },
          },
        },
        scheduleSeat: { select: { seatLabel: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ received: true, processed: false, reason: "booking_not_found" });
    }

    // Confirm booking + create payment in a transaction
    await db.$transaction([
      db.booking.update({ where: { id: order_id }, data: { status: "CONFIRMED" } }),
      db.payment.create({
        data: {
          bookingId:        order_id,
          amount:           parseFloat(payhere_amount),
          currency:         payhere_currency,
          gatewayReference: payment_id,
          gatewayPayload:   { ...Object.fromEntries(formData.entries()), method, status_message },
          paidAt:           new Date(),
        },
      }),
    ]);

    // Send confirmation SMS — non-fatal
    try {
      const { schedule, scheduleSeat } = booking;
      const journeyDateDisplay = booking.journeyDate.toLocaleDateString("en-LK", {
        timeZone: "Asia/Colombo", year: "numeric", month: "short", day: "numeric",
      });
      const departureTimeDisplay = schedule.departureAt.toLocaleString("en-LK", {
        timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit", hour12: true,
      });
      const formattedAmount = new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(
        parseFloat(payhere_amount)
      );

      await sendBookingConfirmation(booking.passengerPhone, {
        bookingId:     booking.id,
        passengerName: booking.passengerName,
        busName:       schedule.bus.name,
        busType:       schedule.bus.busType,
        fromStation:   schedule.fromStation.name,
        toStation:     schedule.toStation.name,
        journeyDate:   journeyDateDisplay,
        departureTime: departureTimeDisplay,
        seatLabel:     scheduleSeat?.seatLabel ?? null,
        amount:        formattedAmount,
      });
    } catch (smsErr) {
      console.error("[webhook] Confirmation SMS failed (non-fatal):", smsErr);
    }

    return NextResponse.json({ received: true, processed: true });
  } catch (err) {
    console.error("[POST /api/payment/webhook]", err);
    return NextResponse.json({ received: true, processed: false, reason: "internal_error" });
  }
}
