"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getScheduleSeats, disableSeat, enableSeat } from "@/lib/api/owner";
import { generateSeatLayout } from "@/lib/seatLayout";
import { useToast } from "@/hooks/use-toast";
import type { OwnerSeat, BusType, SeatStatus } from "@/types/owner";
import type { SeatInfo } from "@/lib/seatLayout";

interface SeatManagementGridProps {
  scheduleId: string;
  busType: BusType;
  rows: number;
  journeyDate: Date;
}

interface SeatWithData extends SeatInfo {
  status: SeatStatus;
  booking: OwnerSeat["booking"];
}

const statusStyles: Record<SeatStatus, string> = {
  available: "bg-green-50 border-green-300 text-green-700 hover:bg-green-100 cursor-pointer",
  confirmed: "bg-blue-50 border-blue-400 text-blue-700 cursor-pointer hover:bg-blue-100",
  pending:   "bg-amber-50 border-amber-300 text-amber-700 cursor-pointer hover:bg-amber-100",
  disabled:  "bg-muted border-border text-muted-foreground line-through cursor-pointer hover:bg-muted/80",
};

export function SeatManagementGrid({
  scheduleId,
  busType,
  rows,
  journeyDate,
}: SeatManagementGridProps) {
  const { toast } = useToast();
  const [seats, setSeats] = useState<SeatWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popoverSeat, setPopoverSeat] = useState<SeatWithData | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const dateStr = format(journeyDate, "yyyy-MM-dd");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getScheduleSeats(scheduleId, dateStr);
      const layout = generateSeatLayout(busType, rows);

      // Merge layout structure with live seat status
      const merged: SeatWithData[] = layout.rows.flatMap((row) =>
        row.seats.map((seatInfo) => {
          const live = res.seats.find((s) => s.label === seatInfo.label);
          return {
            ...seatInfo,
            status:  live?.status  ?? "available",
            booking: live?.booking ?? null,
          };
        })
      );
      setSeats(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load seats.");
    } finally {
      setLoading(false);
    }
  }, [scheduleId, dateStr, busType, rows]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDisable(seat: SeatWithData) {
    setActionLoading(true);
    try {
      await disableSeat(scheduleId, seat.label, dateStr);
      toast({ title: `Seat ${seat.label} disabled` });
      setPopoverSeat(null);
      await load();
    } catch (err) {
      toast({
        title: "Failed to disable seat",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEnable(seat: SeatWithData) {
    setActionLoading(true);
    try {
      await enableSeat(scheduleId, seat.label, dateStr);
      toast({ title: `Seat ${seat.label} enabled` });
      setPopoverSeat(null);
      await load();
    } catch (err) {
      toast({
        title: "Failed to enable seat",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancelBooking(seat: SeatWithData) {
    // Disabling a confirmed seat cancels the booking server-side
    await handleDisable(seat);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading seat map…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      </div>
    );
  }

  // Rebuild into rows using the layout
  const layout = generateSeatLayout(busType, rows);

  return (
    <div className="space-y-4">
      {/* Grid */}
      <div className="w-full overflow-x-auto">
        <div className="flex justify-center mb-3">
          <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
            🚌 Front
          </span>
        </div>

        <div className="space-y-1.5 w-fit mx-auto">
          {layout.rows.map((row) => {
            const rowSeats = row.seats.map(
              (si) => seats.find((s) => s.label === si.label)!
            ).filter(Boolean);

            if (row.isBackRow) {
              return (
                <div key="back" className="flex gap-1.5 mt-1">
                  {rowSeats.map((seat) => (
                    <SeatButton
                      key={seat.label}
                      seat={seat}
                      isSelected={popoverSeat?.label === seat.label}
                      onClick={() =>
                        setPopoverSeat(
                          popoverSeat?.label === seat.label ? null : seat
                        )
                      }
                    />
                  ))}
                </div>
              );
            }

            const left  = rowSeats.filter((s) => s.side === "left");
            const right = rowSeats.filter((s) => s.side === "right");

            return (
              <div key={row.rowNumber} className="flex items-center gap-1.5">
                <div className="flex gap-1">
                  {left.map((seat) => (
                    <SeatButton
                      key={seat.label}
                      seat={seat}
                      isSelected={popoverSeat?.label === seat.label}
                      onClick={() =>
                        setPopoverSeat(
                          popoverSeat?.label === seat.label ? null : seat
                        )
                      }
                    />
                  ))}
                </div>
                <div className="w-5 shrink-0" />
                <div className="flex gap-1">
                  {right.map((seat) => (
                    <SeatButton
                      key={seat.label}
                      seat={seat}
                      isSelected={popoverSeat?.label === seat.label}
                      onClick={() =>
                        setPopoverSeat(
                          popoverSeat?.label === seat.label ? null : seat
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Seat popover / detail panel */}
      {popoverSeat && (
        <div className="border rounded-xl p-4 bg-card space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-base">Seat {popoverSeat.label}</span>
              {popoverSeat.isWindow && (
                <span className="ml-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                  Window
                </span>
              )}
            </div>
            <StatusBadge status={popoverSeat.status} />
          </div>

          {/* Booking info */}
          {popoverSeat.booking && (
            <div className="text-sm space-y-0.5 text-muted-foreground bg-muted/40 rounded-lg p-3">
              <p>
                <span className="font-medium text-foreground">
                  {popoverSeat.booking.passengerName}
                </span>
              </p>
              <p>{popoverSeat.booking.passengerPhone}</p>
              <p className="text-xs">
                Booking: <span className="font-mono">{popoverSeat.booking.id.slice(-8)}</span>
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <>
                {(popoverSeat.status === "available" ||
                  popoverSeat.status === "pending") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => handleDisable(popoverSeat)}
                  >
                    Disable seat
                  </Button>
                )}
                {popoverSeat.status === "disabled" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEnable(popoverSeat)}
                  >
                    Enable seat
                  </Button>
                )}
                {popoverSeat.status === "confirmed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => handleCancelBooking(popoverSeat)}
                  >
                    Cancel booking
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => setPopoverSeat(null)}
                >
                  Close
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
        <LegendItem color="bg-green-400"  label="Available" />
        <LegendItem color="bg-blue-400"   label="Confirmed" />
        <LegendItem color="bg-amber-400"  label="Pending" />
        <LegendItem color="bg-muted border border-border" label="Disabled" />
      </div>
    </div>
  );
}

function SeatButton({
  seat,
  isSelected,
  onClick,
}: {
  seat: SeatWithData;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={seat.label}
      className={cn(
        "h-10 w-10 rounded-lg border-2 text-xs font-semibold transition-all duration-100 select-none",
        isSelected
          ? "ring-2 ring-primary ring-offset-1 scale-105"
          : statusStyles[seat.status],
        seat.isWindow && seat.status === "available" &&
          "border-blue-300 bg-blue-50/60 text-blue-700"
      )}
    >
      {seat.label}
    </button>
  );
}

function StatusBadge({ status }: { status: SeatStatus }) {
  const map: Record<SeatStatus, { label: string; className: string }> = {
    available: { label: "Available", className: "bg-green-50 text-green-700 border-green-200" },
    confirmed: { label: "Confirmed", className: "bg-blue-50 text-blue-700 border-blue-200" },
    pending:   { label: "Pending",   className: "bg-amber-50 text-amber-700 border-amber-200" },
    disabled:  { label: "Disabled",  className: "bg-muted text-muted-foreground border-border" },
  };
  const { label, className } = map[status];
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", className)}>
      {label}
    </span>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-sm", color)} />
      {label}
    </span>
  );
}
