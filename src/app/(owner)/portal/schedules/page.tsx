"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { format } from "date-fns"; // FIXED: removed unused filter imports
import { Plus, ArrowRight, MessageSquare } from "lucide-react"; // FIXED: removed CalendarIcon
import { Button } from "@/components/ui/button";
import SeatFillBar from "@/components/owner/SeatFillBar";
import EmptyState from "@/components/shared/EmptyState";
import { ScheduleToggle } from "@/components/owner/ScheduleToggle";
import { getOwnerDashboard } from "@/lib/api/owner";
import { Badge } from "@/components/ui/badge";
import { formatTime12h } from "@/lib/dateHelpers";
import type { OwnerDashboardResponse, OwnerSchedule } from "@/types/owner";
import { cn } from "@/lib/utils";

// FIXED: removed StatusFilter type — no longer needed

interface FlatSchedule {
  schedule: OwnerSchedule;
  busId: string;
  busName: string;
  totalSeats: number;
}

export default function SchedulesPage() {
  const { data: session } = useSession();

  const [dashboard, setDashboard] = useState<OwnerDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // FIXED: track active state locally so toggle updates without full refetch
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

  // FIXED: flat list of ALL schedules — no filtering
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

      {/* FIXED: filter bar removed entirely */}

      {/* ── Schedule list ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-lg border bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : allSchedules.length === 0 ? (
        <EmptyState
          title="No schedules found"
          description="Add a new schedule to get started."
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
          {allSchedules.map(({ schedule, busName, totalSeats }) => {
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
                    {/* Recurring / One-off type badge */}
                    {schedule.isRecurring ? (
                      <Badge variant="outline" className="px-1.5 py-0 h-4 text-[10px] bg-green-50 text-green-700 border-green-200 ml-1">Daily</Badge>
                    ) : (
                      <Badge variant="outline" className="px-1.5 py-0 h-4 text-[10px] bg-blue-50 text-blue-700 border-blue-200 ml-1">One-off</Badge>
                    )}
                  </div>
                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{busName}</span>
                    <span>·</span>
                    <span>{formatTime12h(schedule.departureTime)}</span>
                    {!schedule.isRecurring && schedule.departureAt && (
                       <span>{format(new Date(schedule.departureAt), "dd MMM yyyy")}</span>
                    )}
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
