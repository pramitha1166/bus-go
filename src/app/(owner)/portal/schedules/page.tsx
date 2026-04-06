"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { format, isToday, isFuture, isPast } from "date-fns";
import { CalendarIcon, Plus, ArrowRight, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import SeatFillBar from "@/components/owner/SeatFillBar";
import EmptyState from "@/components/shared/EmptyState";
// NEW
import { ScheduleToggle } from "@/components/owner/ScheduleToggle";
import { getOwnerDashboard } from "@/lib/api/owner";
import type { OwnerDashboardResponse, OwnerSchedule } from "@/types/owner";
import { cn } from "@/lib/utils";

type StatusFilter = "upcoming" | "today" | "past";

interface FlatSchedule {
  schedule: OwnerSchedule;
  busId: string;
  busName: string;
  totalSeats: number;
}

export default function SchedulesPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const preSelectedBusId = searchParams.get("busId") ?? "all";

  const [dashboard, setDashboard] = useState<OwnerDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [busFilter, setBusFilter] = useState<string>(preSelectedBusId);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("upcoming");
  const [dateOpen, setDateOpen] = useState(false);
  // NEW: track active state locally so toggle updates without full refetch
  const [activeOverrides, setActiveOverrides] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    const ownerId = session?.user?.id;
    if (!ownerId) return;
    setLoading(true);
    try {
      const d = await getOwnerDashboard(ownerId);
      setDashboard(d);
    } catch {
      // silently fail — empty state will show
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const allSchedules: FlatSchedule[] = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.buses.flatMap((bus) =>
      bus.schedules.map((s) => ({
        schedule: s,
        busId: bus.id,
        busName: bus.name,
        totalSeats: bus.totalSeats,
      }))
    );
  }, [dashboard]);

  const filtered = useMemo(() => {
    return allSchedules.filter(({ schedule, busId }) => {
      const dep = new Date(schedule.departureAt);

      if (busFilter !== "all" && busId !== busFilter) return false;

      if (dateFilter) {
        const same =
          format(dep, "yyyy-MM-dd") === format(dateFilter, "yyyy-MM-dd");
        if (!same) return false;
      } else {
        if (statusFilter === "upcoming" && !isFuture(dep) && !isToday(dep))
          return false;
        if (statusFilter === "today" && !isToday(dep)) return false;
        if (statusFilter === "past" && (!isPast(dep) || isToday(dep))) return false;
      }

      return true;
    });
  }, [allSchedules, busFilter, dateFilter, statusFilter]);

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Schedules</h1>
        <Button size="sm" asChild>
          <Link href="/portal/schedules/new">
            <Plus className="w-4 h-4 mr-1.5" />
            Add schedule
          </Link>
        </Button>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {/* Date filter */}
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("gap-2", dateFilter && "border-primary text-primary")}
            >
              <CalendarIcon className="w-4 h-4" />
              {dateFilter ? format(dateFilter, "dd MMM yyyy") : "All dates"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFilter}
              onSelect={(d) => { setDateFilter(d); setDateOpen(false); }}
              initialFocus
            />
            {dateFilter && (
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => { setDateFilter(undefined); setDateOpen(false); }}
                >
                  Clear date
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Bus filter */}
        <Select value={busFilter} onValueChange={setBusFilter}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="All buses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All buses</SelectItem>
            {dashboard?.buses.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        {!dateFilter && (
          <div className="flex gap-1">
            {(["upcoming", "today", "past"] as StatusFilter[]).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
                className="capitalize"
              >
                {s}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* ── Schedule list ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-lg border bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No schedules found"
          description="Try changing your filters or add a new schedule."
          action={
            <Button asChild>
              <Link href="/portal/schedules/new">
                <Plus className="w-4 h-4 mr-1.5" />
                Add schedule
              </Link>
            </Button>
          }
          className="border rounded-xl"
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(({ schedule, busName, totalSeats }) => {
            const dep = new Date(schedule.departureAt);
            const isActive = activeOverrides[schedule.id] ?? schedule.isActive;

            return (
              <div
                key={schedule.id}
                className={cn(
                  "bg-card border rounded-xl p-4 flex items-start gap-4 transition-opacity",
                  !isActive && "opacity-60"
                )}
              >
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Route */}
                  <div className="flex items-center gap-1.5 font-medium text-sm">
                    <span className="truncate">{schedule.from}</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{schedule.to}</span>
                  </div>
                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{busName}</span>
                    <span>·</span>
                    <span>{format(dep, "dd MMM yyyy, h:mm a")}</span>
                    <span>·</span>
                    <span className="font-medium text-foreground">
                      LKR {schedule.price.toLocaleString()}
                    </span>
                  </div>
                  {/* Seat fill */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {schedule.confirmedBookings} / {totalSeats} confirmed
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-foreground">
                          LKR {schedule.revenue.toLocaleString()}
                        </span>
                        {schedule.smsNotificationSent ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <MessageSquare className="w-3 h-3" />
                            SMS sent
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground/60">
                            <MessageSquare className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                    <SeatFillBar
                      confirmed={schedule.confirmedBookings}
                      pending={schedule.pendingBookings}
                      total={totalSeats}
                    />
                  </div>
                </div>

                {/* Right column: toggle + view button */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {/* UPDATED: schedule toggle */}
                  <ScheduleToggle
                    scheduleId={schedule.id}
                    isActive={isActive}
                    onToggle={(next) =>
                      setActiveOverrides((prev) => ({ ...prev, [schedule.id]: next }))
                    }
                  />
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/portal/schedules/${schedule.id}`}>View</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
