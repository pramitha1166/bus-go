"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { ArrowRight, Bus, MessageSquare, CalendarIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import BookingsTable from "@/components/owner/BookingsTable";
import ReportDownloadButton from "@/components/owner/ReportDownloadButton";
import EmptyState from "@/components/shared/EmptyState";
// NEW
import { SeatManagementGrid } from "@/components/owner/SeatManagementGrid";
import { CrowdLevelBar } from "@/components/owner/CrowdLevelBar";
import { getScheduleBookings, downloadSeatSheet } from "@/lib/api/owner";
import { cn } from "@/lib/utils";
import type { ScheduleBookingsResponse, OwnerBooking } from "@/types/owner";

export default function ScheduleDetailPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();

  const [data, setData] = useState<ScheduleBookingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // NEW: date picker for seat management
  const [journeyDate, setJourneyDate] = useState<Date>(new Date());
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getScheduleBookings(scheduleId);
        setData(res);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load.";
        if (msg.includes("403") || msg.includes("access")) {
          setForbidden(true);
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [scheduleId]);

  const bookingsByStatus = useMemo(() => {
    if (!data) return { CONFIRMED: [], PENDING: [], CANCELLED: [] };
    const groups: Record<string, OwnerBooking[]> = {
      CONFIRMED: [],
      PENDING: [],
      CANCELLED: [],
    };
    for (const b of data.bookings) {
      groups[b.status]?.push(b);
    }
    return groups as {
      CONFIRMED: OwnerBooking[];
      PENDING: OwnerBooking[];
      CANCELLED: OwnerBooking[];
    };
  }, [data]);

  const totalRevenue = useMemo(() => {
    if (!data) return 0;
    return bookingsByStatus.CONFIRMED.reduce(
      (sum, b) => sum + (b.payment?.amount ?? 0),
      0
    );
  }, [data, bookingsByStatus]);

  if (forbidden) {
    return (
      <EmptyState
        title="Access denied"
        description="This schedule does not belong to your account."
      />
    );
  }

  if (error) {
    return <EmptyState title="Could not load schedule" description={error} />;
  }

  const isNormal = data?.schedule.busType === "NORMAL";
  const showSeatGrid =
    data &&
    (data.schedule.seatSelectionMode === "OPTIONAL" ||
      data.schedule.seatSelectionMode === "REQUIRED");

  return (
    <div className="space-y-5">
      {/* ── Journey header card ─────────────────────────────────────────────── */}
      <div className="bg-card border rounded-2xl p-5 space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : data ? (
          <>
            {/* Route */}
            <div className="flex items-center gap-2 text-2xl font-bold">
              <span>{data.schedule.from}</span>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
              <span>{data.schedule.to}</span>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Bus className="w-4 h-4" />
                Schedule {scheduleId.slice(-8)}
              </span>
              <span>
                {format(new Date(data.schedule.departureAt), "EEEE, dd MMMM yyyy")}
              </span>
              <span>
                Departs {format(new Date(data.schedule.departureAt), "h:mm a")}
              </span>
              <span className="font-medium text-foreground">
                LKR {data.schedule.price.toLocaleString()} / seat
              </span>
              {!data.schedule.isActive && (
                <span className="text-amber-600 font-medium">⏸ Paused</span>
              )}
            </div>

            {/* Seat summary */}
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="bg-green-100 text-green-700 border border-green-200 px-2.5 py-1 rounded-full font-medium">
                {bookingsByStatus.CONFIRMED.length} confirmed
              </span>
              <span className="bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                {bookingsByStatus.PENDING.length} pending
              </span>
              <span className="bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-full font-medium">
                {bookingsByStatus.CANCELLED.length} cancelled
              </span>
            </div>

            {/* Download */}
            <div className="flex items-center justify-between pt-1">
              <ReportDownloadButton
                label="Download seat sheet"
                onDownload={() => downloadSeatSheet(scheduleId)}
              />
            </div>
          </>
        ) : null}
      </div>

      {/* ── Seat management section ─────────────────────────────────────────── */}
      {!loading && data && (
        <div className="bg-card border rounded-2xl p-5 space-y-4">
          {/* Header with date picker */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold">Seat management</h2>
              <p className="text-xs text-muted-foreground">
                {format(journeyDate, "EEEE, dd MMMM yyyy")}
              </p>
            </div>

            {/* Date picker */}
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {format(journeyDate, "dd MMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={journeyDate}
                  onSelect={(d) => {
                    if (d) { setJourneyDate(d); setDateOpen(false); }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Normal bus: crowd level bar */}
          {isNormal && (
            <CrowdLevelBar
              confirmed={bookingsByStatus.CONFIRMED.length}
              pending={bookingsByStatus.PENDING.length}
              totalSeats={data.schedule.totalSeats}
            />
          )}

          {/* Seat-selection buses: interactive seat grid */}
          {showSeatGrid && (
            <SeatManagementGrid
              scheduleId={scheduleId}
              busType={data.schedule.busType}
              rows={Math.round((data.schedule.totalSeats - 5) / (data.schedule.busType === "NORMAL" ? 5 : 4))}
              journeyDate={journeyDate}
            />
          )}
        </div>
      )}

      {/* ── Booking tabs ────────────────────────────────────────────────────── */}
      <Tabs defaultValue="CONFIRMED">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="CONFIRMED" className="flex-1 sm:flex-none gap-2">
            Confirmed
            <Badge variant="secondary" className="text-xs">
              {bookingsByStatus.CONFIRMED.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="PENDING" className="flex-1 sm:flex-none gap-2">
            Pending
            <Badge variant="secondary" className="text-xs">
              {bookingsByStatus.PENDING.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="CANCELLED" className="flex-1 sm:flex-none gap-2">
            Cancelled
            <Badge variant="secondary" className="text-xs">
              {bookingsByStatus.CANCELLED.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="CONFIRMED" className="mt-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <BookingsTable
              bookings={bookingsByStatus.CONFIRMED}
              showPayment
              emptyMessage="No confirmed bookings yet."
            />
          )}

          {/* Revenue summary */}
          {!loading && bookingsByStatus.CONFIRMED.length > 0 && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-800">
                  Revenue ({bookingsByStatus.CONFIRMED.length} confirmed × LKR{" "}
                  {data?.schedule.price.toLocaleString()})
                </span>
                <span className="text-lg font-bold text-green-900">
                  LKR {totalRevenue.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="PENDING" className="mt-4">
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <BookingsTable
              bookings={bookingsByStatus.PENDING}
              emptyMessage="No pending bookings."
            />
          )}
        </TabsContent>

        <TabsContent value="CANCELLED" className="mt-4">
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <BookingsTable
              bookings={bookingsByStatus.CANCELLED}
              emptyMessage="No cancelled bookings."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
