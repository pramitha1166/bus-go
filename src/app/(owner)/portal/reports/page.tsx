"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { format, isToday } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import StatsCard from "@/components/owner/StatsCard";
import ReportDownloadButton from "@/components/owner/ReportDownloadButton";
import EmptyState from "@/components/shared/EmptyState";
import { getOwnerDashboard, downloadDailyReport } from "@/lib/api/owner";
import type { OwnerDashboardResponse, OwnerSchedule } from "@/types/owner";
import { cn } from "@/lib/utils";

interface ScheduleWithBus {
  schedule: OwnerSchedule;
  busName: string;
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const ownerId = session?.user?.id ?? "";

  const [dashboard, setDashboard] = useState<OwnerDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<Date>(new Date());
  const [dateOpen, setDateOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const d = await getOwnerDashboard(ownerId);
      setDashboard(d);
    } catch {
      // empty state handles it
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const dateStr = format(date, "yyyy-MM-dd");

  // Filter schedules to the selected date
  const daySchedules: ScheduleWithBus[] = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.buses.flatMap((bus) =>
      bus.schedules
        .filter(
          (s) =>
            format(new Date(s.departureAt), "yyyy-MM-dd") === dateStr
        )
        .map((s) => ({ schedule: s, busName: bus.name }))
    );
  }, [dashboard, dateStr]);

  // Summary stats for the selected date
  const summary = useMemo(() => {
    const allBookings = daySchedules.flatMap(({ schedule: s }) => ({
      confirmed: s.confirmedBookings,
      pending: s.pendingBookings,
      cancelled: s.cancelledBookings,
      revenue: s.revenue,
    }));

    return {
      total: allBookings.reduce((sum, s) => sum + s.confirmed + s.pending + s.cancelled, 0),
      confirmed: allBookings.reduce((sum, s) => sum + s.confirmed, 0),
      cancelled: allBookings.reduce((sum, s) => sum + s.cancelled, 0),
      revenue: allBookings.reduce((sum, s) => sum + s.revenue, 0),
    };
  }, [daySchedules]);

  const hasData = daySchedules.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Reports</h1>
      </div>

      {/* ── Date picker ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn("gap-2 font-normal")}
            >
              <CalendarIcon className="w-4 h-4" />
              {isToday(date) ? "Today" : format(date, "dd MMMM yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => {
                if (d) setDate(d);
                setDateOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <ReportDownloadButton
          label="Download daily report"
          disabled={!hasData}
          onDownload={() => downloadDailyReport(dateStr)}
        />
      </div>

      {/* ── Stats cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          label="Total bookings"
          value={summary.total}
          loading={loading}
        />
        <StatsCard
          label="Confirmed"
          value={summary.confirmed}
          loading={loading}
        />
        <StatsCard
          label="Cancelled"
          value={summary.cancelled}
          loading={loading}
        />
        <StatsCard
          label="Revenue"
          value={`LKR ${summary.revenue.toLocaleString()}`}
          loading={loading}
        />
      </div>

      {/* ── Breakdown table ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : !hasData ? (
        <EmptyState
          title={`No bookings for ${format(date, "dd MMMM yyyy")}`}
          description="Try a different date."
          className="border rounded-xl"
        />
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Bus</TableHead>
                <TableHead>Departure</TableHead>
                <TableHead className="text-right">Confirmed</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daySchedules.map(({ schedule: s, busName }) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.from} → {s.to}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{busName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(s.departureAt), "h:mm a")}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {s.confirmedBookings}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    LKR {s.revenue.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="bg-muted/40 font-semibold">
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell className="text-right">{summary.confirmed}</TableCell>
                <TableCell className="text-right">
                  LKR {summary.revenue.toLocaleString()}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
