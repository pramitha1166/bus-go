"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Bus } from "lucide-react";
import { SearchBar } from "@/components/passenger/SearchBar";
import { ScheduleCard } from "@/components/passenger/ScheduleCard";
import { ScheduleSkeleton } from "@/components/passenger/ScheduleSkeleton";
import { SeatPickerDialog } from "@/components/passenger/SeatPickerDialog";
import { searchSchedules } from "@/lib/api/passenger";
import type { Schedule } from "@/types/passenger";

export default function BookPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // UPDATED: track station IDs instead of plain strings
  const [lastParams, setLastParams] = useState<{
    fromStationId: string;
    toStationId: string;
    date: string;
  }>({
    fromStationId: "",
    toStationId: "",
    date: format(new Date(), "yyyy-MM-dd"),
  });

  const fetchSchedules = useCallback(
    async (fromStationId: string, toStationId: string, date: string) => {
      setLoading(true);
      setError(null);
      setLastParams({ fromStationId, toStationId, date });
      try {
        const data = await searchSchedules({
          fromStationId: fromStationId || undefined,
          toStationId:   toStationId   || undefined,
          date,
        });
        setSchedules(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load schedules.");
        setSchedules([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Load all schedules for today on mount
  useEffect(() => {
    fetchSchedules("", "", format(new Date(), "yyyy-MM-dd"));
  }, [fetchSchedules]);

  function handleSearch(fromStationId: string, toStationId: string, date: string) {
    fetchSchedules(fromStationId, toStationId, date);
  }

  function handleSelectSchedule(schedule: Schedule) {
    setSelectedSchedule(schedule);
    setDialogOpen(true);
  }

  const hasFilter = lastParams.fromStationId || lastParams.toStationId;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero */}
      <section className="pt-12 pb-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full mb-4">
            <Bus className="h-3.5 w-3.5" />
            Sri Lanka Bus Booking
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
            Book your bus,{" "}
            <span className="text-primary">instantly.</span>
          </h1>
          <p className="mt-3 text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            Search available routes, pick your seat, and pay — all in under a minute.
          </p>
        </div>
      </section>

      {/* Search bar */}
      <section className="px-4 pb-6">
        <div className="max-w-3xl mx-auto">
          <SearchBar onSearch={handleSearch} isLoading={loading} />
        </div>
      </section>

      {/* Results */}
      <section className="px-4 pb-16">
        <div className="max-w-3xl mx-auto">
          {/* Results header */}
          {!loading && !error && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {schedules.length > 0 ? (
                  <>
                    <span className="font-semibold text-foreground">
                      {schedules.length}
                    </span>{" "}
                    {schedules.length === 1 ? "bus" : "buses"} available
                    {!hasFilter && " today"}
                  </>
                ) : (
                  <>No buses found</>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(
                  new Date(lastParams.date + "T00:00:00"),
                  "EEEE, dd MMMM yyyy"
                )}
              </p>
            </div>
          )}

          {loading && <ScheduleSkeleton />}

          {error && !loading && (
            <div className="text-center py-16">
              <p className="text-destructive text-sm">{error}</p>
              <button
                onClick={() =>
                  fetchSchedules(
                    lastParams.fromStationId,
                    lastParams.toStationId,
                    lastParams.date
                  )
                }
                className="mt-3 text-sm text-primary underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && schedules.length === 0 && (
            <div className="text-center py-16 space-y-2">
              <div className="text-4xl">🚌</div>
              <p className="font-semibold text-foreground">No buses available</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {hasFilter
                  ? "No buses found for that route on this date. Try a different date or clear the filter."
                  : "No buses are scheduled for today. Try searching for a different date."}
              </p>
            </div>
          )}

          {!loading && !error && schedules.length > 0 && (
            <div className="space-y-3 transition-opacity duration-200">
              {schedules.map((schedule) => (
                <ScheduleCard
                  key={schedule.id}
                  schedule={schedule}
                  onSelect={handleSelectSchedule}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Seat picker — UPDATED: pass journeyDate */}
      <SeatPickerDialog
        schedule={selectedSchedule}
        journeyDate={lastParams.date}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          fetchSchedules(
            lastParams.fromStationId,
            lastParams.toStationId,
            lastParams.date
          );
        }}
      />
    </main>
  );
}
