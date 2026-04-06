import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import db from "@/lib/db";
import { sendPreJourneySummary } from "@/lib/sms";
import { generateSeatSheet, BookingRow, ScheduleInfo } from "@/lib/excel";

// Vercel Cron: "0 * * * *" — runs every hour on the hour
// Finds schedules departing in the next 1–2 hours (for today's journey date),
// generates a seat sheet Excel, saves it to /tmp, and SMSes the bus owner.

const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now      = new Date();
  const slNow    = new Date(now.getTime() + SL_OFFSET_MS);
  const todayStr = slNow.toISOString().slice(0, 10);
  const journeyDate = new Date(`${todayStr}T00:00:00.000Z`);

  // Today's departure-time window (1–2 hours from now)
  // For recurring schedules departureAt is stored on 1970-01-01, so we compare
  // time-of-day only by extracting the HH:MM from each schedule's departureAt.
  // Simpler approach: query all active schedules and filter in JS by time-of-day.
  const windowStartMs = now.getTime() + 60 * 60 * 1000;   // now + 1h
  const windowEndMs   = now.getTime() + 2 * 60 * 60 * 1000; // now + 2h

  try {
    const schedules = await db.schedule.findMany({
      where: {
        isActive:            true,
        smsNotificationSent: false,
      },
      include: {
        bus:         { include: { owner: true } },
        fromStation: { select: { name: true } },
        toStation:   { select: { name: true } },
        bookings: {
          where:   { status: "CONFIRMED", journeyDate },
          include: { payment: true, scheduleSeat: { select: { seatLabel: true } } },
        },
      },
    });

    type ScheduleResult = typeof schedules[number];

    // Filter by time-of-day window
    const inWindow = schedules.filter((s: ScheduleResult) => {
      const dep = new Date(s.departureAt);
      // Build today's full departure datetime
      const todayDep = new Date(
        `${todayStr}T${dep.toISOString().slice(11, 16)}:00.000Z`
      );
      return todayDep.getTime() >= windowStartMs && todayDep.getTime() <= windowEndMs;
    });

    if (inWindow.length === 0) {
      return NextResponse.json({ processed: 0, message: "No upcoming journeys found" });
    }

    const processedIds: string[] = [];

    await Promise.all(
      inWindow.map(async (schedule: ScheduleResult) => {
        const { bus, bookings, fromStation, toStation } = schedule;

        const dep = new Date(schedule.departureAt);
        const todayDep = new Date(`${todayStr}T${dep.toISOString().slice(11, 16)}:00.000Z`);
        const departureStr = todayDep.toLocaleString("en-LK", {
          timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit", hour12: true,
        });
        const journeyDateDisplay = journeyDate.toLocaleDateString("en-LK", {
          timeZone: "Asia/Colombo", year: "numeric", month: "short", day: "numeric",
        });

        // Excel generation (non-fatal)
        try {
          type BookingResult = typeof bookings[number];
          const bookingRows: BookingRow[] = bookings.map((b: BookingResult) => ({
            seatLabel:      b.scheduleSeat?.seatLabel ?? null,
            passengerName:  b.passengerName,
            passengerPhone: b.passengerPhone,
            bookingStatus:  b.status,
            paymentStatus:  b.payment ? "PAID" : "UNPAID",
            paymentRef:     b.payment?.gatewayReference ?? null,
            bookedAt:       b.createdAt,
            journeyDate:    b.journeyDate,
          }));

          const scheduleInfo: ScheduleInfo = {
            from:        fromStation.name,
            to:          toStation.name,
            totalSeats:  bus.totalSeats,
            busType:     bus.busType,
            journeyDate: journeyDateDisplay,
          };

          const buffer   = await generateSeatSheet(bookingRows, scheduleInfo);
          const filePath = join("/tmp", `seat-sheet-${schedule.id}-${todayStr}.xlsx`);
          await writeFile(filePath, buffer);
        } catch (excelErr) {
          console.error(`[cron/pre-journey] Excel failed for ${schedule.id}:`, excelErr);
        }

        // Pre-journey SMS to bus owner (non-fatal)
        try {
          await sendPreJourneySummary(
            bus.owner.phone,
            bus.name,
            bus.busType,
            fromStation.name,
            toStation.name,
            journeyDateDisplay,
            bookings.length,
            bus.totalSeats,
            departureStr
          );
        } catch (smsErr) {
          console.error(`[cron/pre-journey] SMS failed for ${schedule.id}:`, smsErr);
        }

        await db.schedule.update({
          where: { id: schedule.id },
          data:  { smsNotificationSent: true },
        });

        processedIds.push(schedule.id);
      })
    );

    return NextResponse.json({ processed: processedIds.length, schedules: processedIds });
  } catch (err) {
    console.error("[cron/pre-journey]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
