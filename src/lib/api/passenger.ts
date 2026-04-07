import type {
  Booking,
  CreateBookingInput,
  PayHerePayment,
  Schedule,
  SearchParams,
  Seat,
} from "@/types/passenger";

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "An unexpected error occurred.");
  return data as T;
}

import { format } from "date-fns";

// FIXED: searchSchedules always sends a date (defaults to today) and handles flat array response
export async function searchSchedules(params: SearchParams): Promise<Schedule[]> {
  const searchDate = params.date || format(new Date(), 'yyyy-MM-dd'); // Fix B/F: default to today
  const sp = new URLSearchParams({ date: searchDate });
  if (params.fromStationId) sp.set("fromStationId", params.fromStationId);
  if (params.toStationId)   sp.set("toStationId",   params.toStationId);

  // Fix E: API now returns a flat array (not wrapped in { schedules: [] })
  const data = await apiFetch<Schedule[]>(`/api/schedules?${sp.toString()}`);
  return data;
}

// FIXED: getSeats needs journeyDate
export async function getSeats(scheduleId: string, journeyDate: string): Promise<Seat[]> {
  const data = await apiFetch<{ seats: Seat[] }>(`/api/schedules/${scheduleId}/seats?journeyDate=${journeyDate}`);
  return data.seats;
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const data = await apiFetch<{ booking: Booking }>("/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return data.booking;
}

export async function initiatePayment(bookingId: string): Promise<PayHerePayment> {
  const data = await apiFetch<{ payment: PayHerePayment }>("/api/payment/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId }),
  });
  return data.payment;
}

export async function getBooking(bookingId: string): Promise<Booking> {
  const data = await apiFetch<{ booking: Booking }>(`/api/bookings/${bookingId}`);
  return data.booking;
}

/** Submits a hidden form to the PayHere checkout URL to initiate payment. */
export function redirectToPayHere(payment: PayHerePayment): void {
  const url = payment.sandbox
    ? "https://sandbox.payhere.lk/pay/checkout"
    : "https://www.payhere.lk/pay/checkout";

  const form = document.createElement("form");
  form.method = "POST";
  form.action = url;

  const { sandbox: _sandbox, ...fields } = payment;
  Object.entries(fields).forEach(([key, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = String(value);
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}
