"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import {
  Loader2,
  Bus,
  Plus,
  CheckCircle2,
  Users,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getOwnerDashboard, createSchedule } from "@/lib/api/owner";
import { StationSelect } from "@/components/shared/StationSelect";
import { ActiveDaysSelector, ALL_DAYS, daysToString } from "@/components/owner/ActiveDaysSelector";
import { cn } from "@/lib/utils";
import type { BusType, OwnerBus } from "@/types/owner";
import type { StationSummary } from "@/types/passenger";
import type { DayKey } from "@/components/owner/ActiveDaysSelector";

// ── Bus type badge ─────────────────────────────────────────────────────────────
const BUS_TYPE_LABELS: Record<BusType, string> = {
  NORMAL:      "Normal",
  SEMI_LUXURY: "Semi-Luxury",
  LUXURY:      "Luxury",
  EXPRESSWAY:  "Expressway",
};

const BUS_TYPE_COLORS: Record<BusType, string> = {
  NORMAL:      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  SEMI_LUXURY: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  LUXURY:      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  EXPRESSWAY:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

function BusTypeBadge({ type }: { type: BusType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        BUS_TYPE_COLORS[type]
      )}
    >
      {BUS_TYPE_LABELS[type]}
    </span>
  );
}

// ── Schedule form schema ───────────────────────────────────────────────────────
const scheduleSchema = z.object({
  time: z
    .string()
    .min(1, "Departure time is required")
    .regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
  date: z.string().optional(),
  price: z
    .number({ invalid_type_error: "Must be a number" })
    .positive("Price must be greater than 0"),
});

type ScheduleFormValues = z.infer<typeof scheduleSchema>;

export default function AddSchedulePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const ownerId = session?.user?.id ?? "";

  // ── Bus selection state ───────────────────────────────────────────────────
  const [buses, setBuses]           = useState<OwnerBus[]>([]);
  const [busesLoading, setBusesLoading] = useState(true);
  const [selectedBus, setSelectedBus]   = useState<OwnerBus | null>(null);

  // ── Schedule form state ───────────────────────────────────────────────────
  const [fromStation, setFromStation]   = useState<StationSummary | null>(null);
  const [toStation, setToStation]       = useState<StationSummary | null>(null);
  const [isRecurring, setIsRecurring]   = useState(true);
  const [activeDays, setActiveDays]     = useState<DayKey[]>(ALL_DAYS);
  const [stationError, setStationError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { time: "08:00", price: undefined as unknown as number },
  });

  // ── Fetch owner buses ─────────────────────────────────────────────────────
  const fetchBuses = useCallback(async () => {
    if (!ownerId) return;
    setBusesLoading(true);
    try {
      const data = await getOwnerDashboard(ownerId);
      setBuses(data.buses);
    } catch {
      setBuses([]);
    } finally {
      setBusesLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    fetchBuses();
  }, [fetchBuses]);

  // ── Handle schedule submit ────────────────────────────────────────────────
  const handleScheduleSubmit = async (values: ScheduleFormValues) => {
    if (!selectedBus) return;

    if (!fromStation || !toStation) {
      setStationError("Both origin and destination are required.");
      return;
    }
    setStationError(null);
    setScheduleError(null);

    let departureAt: string;

    if (isRecurring) {
      departureAt = `1970-01-01T${values.time}:00.000Z`;
    } else {
      if (!values.date) {
        form.setError("date", { message: "Date is required for one-time schedules." });
        return;
      }
      const [h, m] = values.time.split(":").map(Number);
      const d = new Date(values.date);
      d.setHours(h, m, 0, 0);
      departureAt = d.toISOString();
    }

    try {
      await createSchedule({
        busId:         selectedBus.id,
        fromStationId: fromStation.id,
        toStationId:   toStation.id,
        departureAt,
        price:         values.price,
        isRecurring,
        activeDays:    isRecurring ? daysToString(activeDays) : undefined,
      });
      toast({ title: "Schedule added successfully." });
      router.push("/portal/schedules");
    } catch (err) {
      setScheduleError(
        err instanceof Error ? err.message : "Failed to add schedule."
      );
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Back button */}
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground" asChild>
        <Link href="/portal/schedules">
          <ArrowLeft className="w-4 h-4" />
          Back to schedules
        </Link>
      </Button>

      {/* ── Step 1: Select bus ─────────────────────────────────────────────── */}
      <div className="bg-card border rounded-2xl p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold mb-1">Which bus is this schedule for?</h1>
          <p className="text-sm text-muted-foreground">
            Select a bus to create a schedule for.
          </p>
        </div>

        {busesLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 rounded-xl border bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : buses.length === 0 ? (
          // Empty state — no buses
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Bus className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm">You need to add a bus first</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add a bus before creating a schedule.
              </p>
            </div>
            <Button size="sm" asChild>
              <Link href="/portal/buses/new">
                <Plus className="w-4 h-4 mr-1.5" />
                Add bus
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {buses.map((bus) => (
              <button
                key={bus.id}
                type="button"
                onClick={() => setSelectedBus(bus.id === selectedBus?.id ? null : bus)}
                className={cn(
                  "w-full text-left rounded-xl border p-4 transition-all duration-200",
                  "hover:border-primary/50 hover:bg-accent/50",
                  selectedBus?.id === bus.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-card"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Bus className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{bus.name}</span>
                        <BusTypeBadge type={bus.busType} />
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {bus.regNumber}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 text-right">
                    <div className="hidden sm:block">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                        <Users className="w-3 h-3" />
                        <span>{bus.totalSeats} seats</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end mt-0.5">
                        <Calendar className="w-3 h-3" />
                        <span>{bus.schedules.length} schedule{bus.schedules.length !== 1 ? "s" : ""}</span>
                      </div>
                    </div>

                    {selectedBus?.id === bus.id && (
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Step 2: Schedule details (revealed after bus selected) ─────────── */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          selectedBus ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          {/* Sticky selected bus summary bar */}
          {selectedBus && (
            <div className="mb-3 flex items-center gap-2.5 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-sm font-semibold truncate">{selectedBus.name}</span>
                <BusTypeBadge type={selectedBus.busType} />
                <span className="text-xs text-muted-foreground">{selectedBus.regNumber}</span>
              </div>
            </div>
          )}

          <div className="bg-card border rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold mb-1">Schedule details</h2>
              <p className="text-sm text-muted-foreground">
                Configure when and where this bus runs.
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleScheduleSubmit)} className="space-y-4">

                {/* From / To stations */}
                <div className="space-y-3">
                  <div className="flex items-end gap-2">
                    <StationSelect
                      label="From"
                      placeholder="Origin station"
                      value={fromStation}
                      onChange={(s) => { setFromStation(s); setStationError(null); }}
                      className="flex-1"
                    />
                    {/* Swap button */}
                    <button
                      type="button"
                      onClick={() => {
                        const tmp = fromStation;
                        setFromStation(toStation);
                        setToStation(tmp);
                      }}
                      className="mb-0.5 p-2 rounded-lg border border-input hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      aria-label="Swap stations"
                    >
                      ⇄
                    </button>
                    <StationSelect
                      label="To"
                      placeholder="Destination station"
                      value={toStation}
                      onChange={(s) => { setToStation(s); setStationError(null); }}
                      className="flex-1"
                    />
                  </div>
                  {stationError && (
                    <p className="text-xs text-destructive">{stationError}</p>
                  )}
                </div>

                {/* Repeats daily toggle */}
                <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Repeats daily</p>
                    <p className="text-xs text-muted-foreground">
                      {isRecurring
                        ? "Runs every selected day at the chosen time"
                        : "One-time journey on a specific date"}
                    </p>
                  </div>
                  <Switch
                    checked={isRecurring}
                    onCheckedChange={setIsRecurring}
                  />
                </div>

                {/* Active days — only when recurring */}
                {isRecurring && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">Active days</Label>
                    <ActiveDaysSelector value={activeDays} onChange={setActiveDays} />
                  </div>
                )}

                {/* Date — only when one-time */}
                {!isRecurring && (
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departure date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            min={new Date().toISOString().split("T")[0]}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Departure time */}
                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Departure time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Ticket price */}
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ticket price (LKR)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          placeholder="e.g. 350"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? undefined : Number(e.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {scheduleError && (
                  <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                    {scheduleError}
                  </p>
                )}

                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Add schedule
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => router.push("/portal/schedules")}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
