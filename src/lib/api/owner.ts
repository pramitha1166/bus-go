import type {
  OwnerDashboardResponse,
  OwnerStatsResponse,
  ScheduleBookingsResponse,
  ScheduleSeatsResponse,
  CreateBusInput,
  CreateScheduleInput,
  CreateOwnerInput,
} from "@/types/owner";
import type { StationSummary } from "@/types/passenger";

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Unauthenticated");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

// ─── Owner data ────────────────────────────────────────────────────────────────

export async function getOwnerDashboard(
  ownerId: string
): Promise<OwnerDashboardResponse> {
  return apiFetch<OwnerDashboardResponse>(`/api/portal/owner/${ownerId}`);
}

export async function getOwnerStats(
  ownerId: string
): Promise<OwnerStatsResponse> {
  return apiFetch<OwnerStatsResponse>(`/api/portal/stats/${ownerId}`);
}

// ─── Stations ─────────────────────────────────────────────────────────────────

export async function getStations(search?: string): Promise<StationSummary[]> {
  const sp = new URLSearchParams();
  if (search) sp.set("search", search);
  const data = await apiFetch<{ stations: StationSummary[] }>(
    `/api/stations?${sp.toString()}`
  );
  return data.stations;
}

// ─── Schedule & bookings ───────────────────────────────────────────────────────

export async function getScheduleBookings(
  scheduleId: string
): Promise<ScheduleBookingsResponse> {
  return apiFetch<ScheduleBookingsResponse>(
    `/api/portal/schedule/${scheduleId}/bookings`
  );
}

// NEW: fetch per-seat status for a specific journey date
export async function getScheduleSeats(
  scheduleId: string,
  journeyDate: string  // YYYY-MM-DD
): Promise<ScheduleSeatsResponse> {
  return apiFetch<ScheduleSeatsResponse>(
    `/api/portal/schedules/${scheduleId}/seats?date=${journeyDate}`
  );
}

// NEW: toggle schedule active/paused
export async function toggleSchedule(
  scheduleId: string
): Promise<{ isActive: boolean }> {
  return apiFetch<{ isActive: boolean }>(
    `/api/portal/schedules/${scheduleId}/toggle`,
    { method: "PATCH" }
  );
}

// NEW: disable a seat for a specific journey date
export async function disableSeat(
  scheduleId: string,
  seatLabel: string,
  journeyDate: string
): Promise<void> {
  await apiFetch(`/api/portal/schedules/${scheduleId}/seats/disable`, {
    method: "POST",
    body: JSON.stringify({ seatLabel, journeyDate }),
  });
}

// NEW: enable a seat for a specific journey date
export async function enableSeat(
  scheduleId: string,
  seatLabel: string,
  journeyDate: string
): Promise<void> {
  await apiFetch(`/api/portal/schedules/${scheduleId}/seats/enable`, {
    method: "POST",
    body: JSON.stringify({ seatLabel, journeyDate }),
  });
}

// ─── File downloads (triggers browser download) ───────────────────────────────

async function downloadFile(url: string, fallbackName: string): Promise<void> {
  const res = await fetch(url);

  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Unauthenticated");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Download failed (${res.status})`);
  }

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? fallbackName;

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export async function downloadSeatSheet(scheduleId: string): Promise<void> {
  await downloadFile(
    `/api/portal/schedule/${scheduleId}/excel`,
    `seat-sheet-${scheduleId}.xlsx`
  );
}

export async function downloadDailyReport(date: string): Promise<void> {
  await downloadFile(
    `/api/portal/daily-report/excel?date=${date}`,
    `daily-report-${date}.xlsx`
  );
}

// ─── Bus & schedule creation ───────────────────────────────────────────────────

// UPDATED: now sends busType + rows (totalSeats is calculated server-side)
export async function createBus(
  data: CreateBusInput
): Promise<{ bus: { id: string; name: string } }> {
  return apiFetch("/api/portal/buses", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// UPDATED: now sends fromStationId, toStationId, isRecurring, activeDays
export async function createSchedule(
  data: CreateScheduleInput
): Promise<{ schedule: { id: string } }> {
  return apiFetch("/api/portal/schedules", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createOwner(
  data: CreateOwnerInput
): Promise<{ owner: { id: string; phone: string } }> {
  const res = await fetch("/api/owners", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }

  return res.json();
}
