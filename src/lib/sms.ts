import axios from "axios";

const NOTIFY_LK_ENDPOINT = "https://app.notify.lk/api/v1/send";

// ─────────────────────────────────────────────────────────────────────────────
// Base send function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends an SMS via the notify.lk REST API.
 *
 * @param phone   Recipient in Sri Lanka format: 94xxxxxxxxx
 * @param message Plain-text message body (max 160 chars per segment)
 */
export async function sendSMS(phone: string, message: string): Promise<void> {
  const userId = process.env.NOTIFY_LK_USER_ID;
  const apiKey = process.env.NOTIFY_LK_API_KEY;
  const senderId = process.env.NOTIFY_LK_SENDER_ID;

  if (!userId || !apiKey || !senderId) {
    console.error("[SMS] Missing notify.lk credentials in environment variables.");
    return;
  }

  try {
    const response = await axios.post(
      NOTIFY_LK_ENDPOINT,
      new URLSearchParams({
        user_id: userId,
        api_key: apiKey,
        sender_id: senderId,
        to: phone,
        message,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 10_000,
      }
    );

    // notify.lk returns { status: "success" | "error", message: string }
    if (response.data?.status !== "success") {
      console.error(
        `[SMS] notify.lk rejected message to ${phone}:`,
        response.data
      );
    }
  } catch (err) {
    // Log the failure but never throw — SMS is non-critical infrastructure
    console.error(`[SMS] Failed to send SMS to ${phone}:`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain-specific helpers
// ─────────────────────────────────────────────────────────────────────────────

interface BookingDetails {
  bookingId:       string;
  passengerName:   string;
  busName:         string;
  busType:         string;  // e.g. "LUXURY"
  fromStation:     string;  // origin station name
  toStation:       string;  // destination station name
  journeyDate:     string;  // e.g. "01 Apr 2026"
  departureTime:   string;  // e.g. "08:30 AM"
  /** Seat label e.g. "2A" — null/undefined for NONE-mode buses */
  seatLabel?:      string | null;
  amount:          string;  // e.g. "LKR 1,500.00"
}

/**
 * Sends a booking confirmation SMS to the passenger.
 */
export async function sendBookingConfirmation(
  phone: string,
  details: BookingDetails
): Promise<void> {
  const seatInfo = details.seatLabel
    ? `Seat: ${details.seatLabel}`
    : "Seat not assigned";

  const message =
    `Hi ${details.passengerName}, your booking is CONFIRMED!\n` +
    `Booking ID: ${details.bookingId}\n` +
    `Bus: ${details.busName} (${details.busType})\n` +
    `Route: ${details.fromStation} → ${details.toStation}\n` +
    `Journey Date: ${details.journeyDate}\n` +
    `Departure: ${details.departureTime}\n` +
    `${seatInfo} | Paid: ${details.amount}`;

  await sendSMS(phone, message);
}

/**
 * Sends a pre-journey summary SMS to the bus owner approximately 2 hours
 * before departure. Called by the /api/cron/pre-journey cron job.
 */
export async function sendPreJourneySummary(
  phone: string,
  busName: string,
  busType: string,
  fromStation: string,
  toStation: string,
  journeyDate: string,
  confirmedBookings: number,
  totalSeats: number,
  departureTime: string
): Promise<void> {
  const message =
    `Bus Journey Reminder\n` +
    `Bus: ${busName} (${busType})\n` +
    `Route: ${fromStation} → ${toStation}\n` +
    `Journey Date: ${journeyDate}\n` +
    `Departure: ${departureTime}\n` +
    `Confirmed bookings: ${confirmedBookings} / ${totalSeats} seat(s)\n` +
    `Please ensure the bus is ready. Safe travels!`;

  await sendSMS(phone, message);
}

/**
 * Sends the end-of-day summary SMS to the admin.
 * Called by the /api/cron/daily-report cron job at 11:55 PM.
 *
 * @param phone          Admin phone (94xxxxxxxxx)
 * @param totalBookings  Total confirmed bookings for today
 * @param totalRevenue   Total revenue collected today (LKR)
 */
// ─────────────────────────────────────────────────────────────────────────────
// sendSMSStrict — throws on failure (used where per-send failure tracking matters)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends an arbitrary SMS and THROWS on delivery failure.
 * Use this when you need to track sent vs failed counts (e.g. bulk broadcast).
 * For non-critical messages use sendSMS which swallows errors.
 */
export async function sendSMSStrict(phone: string, message: string): Promise<void> {
  const userId   = process.env.NOTIFY_LK_USER_ID;
  const apiKey   = process.env.NOTIFY_LK_API_KEY;
  const senderId = process.env.NOTIFY_LK_SENDER_ID;

  if (!userId || !apiKey || !senderId) {
    throw new Error("Missing notify.lk credentials in environment variables.");
  }

  const response = await axios.post(
    NOTIFY_LK_ENDPOINT,
    new URLSearchParams({ user_id: userId, api_key: apiKey, sender_id: senderId, to: phone, message }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 10_000 }
  );

  if (response.data?.status !== "success") {
    throw new Error(`SMS delivery failed: ${JSON.stringify(response.data)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// sendOtpCode — throws on failure (OTP delivery must not silently fail)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends the OTP verification code via SMS.
 * Unlike sendSMS, this function THROWS on any delivery failure so the caller
 * can return HTTP 500 rather than silently continuing.
 */
export async function sendOtpCode(phone: string, code: string): Promise<void> {
  const userId   = process.env.NOTIFY_LK_USER_ID;
  const apiKey   = process.env.NOTIFY_LK_API_KEY;
  const senderId = process.env.NOTIFY_LK_SENDER_ID;

  if (!userId || !apiKey || !senderId) {
    throw new Error("Missing notify.lk credentials in environment variables.");
  }

  const message = `Your BusBook verification code is ${code}. Valid for 5 minutes. Do not share this code.`;

  const response = await axios.post(
    NOTIFY_LK_ENDPOINT,
    new URLSearchParams({ user_id: userId, api_key: apiKey, sender_id: senderId, to: phone, message }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 10_000 }
  );

  if (response.data?.status !== "success") {
    throw new Error(`SMS delivery failed: ${JSON.stringify(response.data)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function sendDailyReport(
  phone: string,
  totalBookings: number,
  totalRevenue: number
): Promise<void> {
  const date = new Date().toLocaleDateString("en-LK", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedRevenue = new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
  }).format(totalRevenue);

  const message =
    `Daily Report — ${date}\n` +
    `Total Bookings: ${totalBookings}\n` +
    `Total Revenue: ${formattedRevenue}\n` +
    `— Bus Booking System`;

  await sendSMS(phone, message);
}
