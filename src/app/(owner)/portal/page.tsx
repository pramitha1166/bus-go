"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { format, isToday } from "date-fns";
import {
  Bus,
  Calendar,
  Ticket,
  TrendingUp,
  Plus,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import StatsCard from "@/components/owner/StatsCard";
import ScheduleRow from "@/components/owner/ScheduleRow";
import BusCard from "@/components/owner/BusCard";
import EmptyState from "@/components/shared/EmptyState";
import { getOwnerDashboard, getOwnerStats } from "@/lib/api/owner";
import type { OwnerDashboardResponse, OwnerStatsResponse } from "@/types/owner";

export default function PortalDashboardPage() {
  const { data: session } = useSession();
  const ownerId = session?.user?.id ?? "";

  const [dashboard, setDashboard] = useState<OwnerDashboardResponse | null>(null);
  const [stats, setStats] = useState<OwnerStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    setError(null);
    try {
      const [d, s] = await Promise.all([
        getOwnerDashboard(ownerId),
        getOwnerStats(ownerId),
      ]);
      setDashboard(d);
      setStats(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Today's schedules across all buses
  const todaySchedules = dashboard?.buses.flatMap((bus) =>
    bus.schedules
      .filter((s) => isToday(new Date(s.departureAt)))
      .map((s) => ({ schedule: s, bus }))
  ) ?? [];

  if (error) {
    return (
      <EmptyState
        title="Could not load dashboard"
        description={error}
        action={
          <Button onClick={fetchData} variant="outline">
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          label="Total buses"
          value={dashboard?.stats.totalBuses ?? 0}
          icon={<Bus className="w-4 h-4" />}
          loading={loading}
        />
        <StatsCard
          label="Total schedules"
          value={dashboard?.stats.totalSchedules ?? 0}
          icon={<Calendar className="w-4 h-4" />}
          loading={loading}
        />
        <StatsCard
          label="Confirmed (month)"
          value={stats?.thisMonth.confirmedBookings ?? 0}
          icon={<Ticket className="w-4 h-4" />}
          trend={`${stats?.today.confirmedBookings ?? 0} today`}
          loading={loading}
        />
        <StatsCard
          label="Revenue (month)"
          value={
            stats
              ? `LKR ${stats.thisMonth.totalRevenue.toLocaleString()}`
              : "—"
          }
          icon={<TrendingUp className="w-4 h-4" />}
          trend={`LKR ${stats?.today.totalRevenue.toLocaleString() ?? 0} today`}
          loading={loading}
        />
      </div>

      {/* ── Today's journeys ──────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-base">Today&apos;s journeys</h2>
            <p className="text-xs text-muted-foreground">
              {format(new Date(), "EEEE, dd MMMM yyyy")}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-24 rounded-lg border bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        ) : todaySchedules.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="w-12 h-12" />}
            title="No journeys scheduled for today"
            action={
              <Button asChild>
                <Link href="/portal/schedules/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Add schedule
                </Link>
              </Button>
            }
            className="border rounded-xl py-12"
          />
        ) : (
          <div className="space-y-2">
            {todaySchedules.map(({ schedule, bus }) => (
              <ScheduleRow
                key={schedule.id}
                schedule={schedule}
                busName={bus.name}
                totalSeats={bus.totalSeats}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── My buses ─────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-base">My buses</h2>
          <Button size="sm" asChild>
            <Link href="/portal/buses/new">
              <Plus className="w-4 h-4 mr-1.5" />
              Add bus
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-40 rounded-xl border bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        ) : !dashboard || dashboard.buses.length === 0 ? (
          <EmptyState
            icon={<Bus className="w-12 h-12" />}
            title="You haven't added any buses yet"
            description="Add your first bus to start managing schedules and bookings."
            action={
              <Button asChild size="lg">
                <Link href="/portal/buses/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Add your first bus
                </Link>
              </Button>
            }
            className="border rounded-xl py-12"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dashboard.buses.map((bus) => (
              <BusCard key={bus.id} bus={bus} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
