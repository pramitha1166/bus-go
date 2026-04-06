"use client";

import { cn } from "@/lib/utils";
import type { Seat, SeatStatus } from "@/types/passenger";

interface SeatGridProps {
  seats: Seat[];
  selectedSeat: string | null;          // UPDATED: label string, not number
  onSeatSelect: (label: string) => void; // UPDATED
  highlightWindows?: boolean;            // NEW: for LUXURY buses
}

const statusStyles: Record<SeatStatus, string> = {
  available: "bg-green-50 border-green-300 text-green-700 hover:bg-green-100 cursor-pointer",
  pending:   "bg-amber-50 border-amber-300 text-amber-600 cursor-not-allowed opacity-70",
  confirmed: "bg-red-50 border-red-300 text-red-500 cursor-not-allowed opacity-70",
  disabled:  "bg-muted border-border text-muted-foreground cursor-not-allowed opacity-50",
};

const statusLabel: Record<SeatStatus, string> = {
  available: "Available",
  pending:   "Pending",
  confirmed: "Taken",
  disabled:  "Disabled",
};

function SeatButton({
  seat,
  isSelected,
  onSelect,
  highlightWindow,
}: {
  seat: Seat;
  isSelected: boolean;
  onSelect: () => void;
  highlightWindow?: boolean;
}) {
  const isDisabled = seat.status !== "available";

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onSelect}
      title={`Seat ${seat.label}${seat.isWindow && highlightWindow ? " (Window)" : ""} — ${statusLabel[seat.status]}`}
      aria-label={`Seat ${seat.label} — ${statusLabel[seat.status]}`}
      className={cn(
        "h-11 w-11 rounded-lg border-2 text-xs font-semibold transition-all duration-100 select-none relative",
        isSelected
          ? "bg-primary border-primary text-primary-foreground shadow-md scale-105"
          : seat.isWindow && highlightWindow && seat.status === "available"
          ? "bg-blue-50 border-blue-400 text-blue-700 hover:bg-blue-100 cursor-pointer"
          : statusStyles[seat.status]
      )}
    >
      {seat.label}
      {/* Small window indicator dot for luxury buses */}
      {seat.isWindow && highlightWindow && !isSelected && (
        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-400 border border-white" />
      )}
    </button>
  );
}

export function SeatGrid({ seats, selectedSeat, onSeatSelect, highlightWindows }: SeatGridProps) {
  if (seats.length === 0) return null;

  // Separate back row from regular rows; group regular seats by position
  const backSeats = seats.filter((s) => s.side === "back");
  const regularSeats = seats.filter((s) => s.side !== "back");

  // Group into rows: each regular row has 4 seats (left A,B + right C,D)
  // or 5 for NORMAL (A,B + C,D,E). Detect by checking max position.
  const seatsPerRow = regularSeats.length > 0
    ? Math.max(...regularSeats.map((s) => s.position))
    : 4;

  const rowCount = regularSeats.length / seatsPerRow;
  const rows: Seat[][] = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push(regularSeats.slice(i * seatsPerRow, (i + 1) * seatsPerRow));
  }

  const isNormalLayout = seatsPerRow === 5;

  return (
    <div className="w-full overflow-y-auto max-h-[360px] pr-1">
      {/* Bus front */}
      <div className="flex justify-center mb-3">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          🚌 Front
        </span>
      </div>

      <div className="space-y-2">
        {/* Regular rows */}
        {rows.map((row, rowIndex) => {
          const leftSeats  = row.filter((s) => s.side === "left");
          const rightSeats = row.filter((s) => s.side === "right");

          return (
            <div key={rowIndex} className="flex items-center justify-center gap-2">
              <div className="flex gap-1.5">
                {leftSeats.map((seat) => (
                  <SeatButton
                    key={seat.label}
                    seat={seat}
                    isSelected={selectedSeat === seat.label}
                    onSelect={() => onSeatSelect(seat.label)}
                    highlightWindow={highlightWindows}
                  />
                ))}
              </div>
              <div className="w-6 flex-shrink-0" />
              <div className="flex gap-1.5">
                {rightSeats.map((seat) => (
                  <SeatButton
                    key={seat.label}
                    seat={seat}
                    isSelected={selectedSeat === seat.label}
                    onSelect={() => onSeatSelect(seat.label)}
                    highlightWindow={highlightWindows}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Back row */}
        {backSeats.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 mt-1">
            {backSeats.map((seat) => (
              <SeatButton
                key={seat.label}
                seat={seat}
                isSelected={selectedSeat === seat.label}
                onSelect={() => onSeatSelect(seat.label)}
                highlightWindow={highlightWindows}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SeatLegend({ showWindow }: { showWindow?: boolean }) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <LegendItem color="bg-green-400"  label="Available" />
      <LegendItem color="bg-red-400"    label="Taken" />
      <LegendItem color="bg-amber-400"  label="Pending" />
      <LegendItem color="bg-primary"    label="Your selection" />
      {showWindow && (
        <LegendItem color="bg-blue-400" label="Window seat" />
      )}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
