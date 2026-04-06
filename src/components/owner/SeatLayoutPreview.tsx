"use client";

import { cn } from "@/lib/utils";
import { generateSeatLayout } from "@/lib/seatLayout";
import type { BusType } from "@/types/owner";

interface SeatLayoutPreviewProps {
  busType: BusType;
  rows: number;
}

export function SeatLayoutPreview({ busType, rows }: SeatLayoutPreviewProps) {
  const layout = generateSeatLayout(busType, Math.max(1, rows));

  return (
    <div className="w-full overflow-x-auto">
      {/* Bus front */}
      <div className="flex justify-center mb-2">
        <span className="text-xs text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
          Front
        </span>
      </div>

      <div className="flex flex-col gap-1 items-center">
        {layout.rows.map((row) => {
          const leftSeats  = row.seats.filter((s) => s.side === "left");
          const rightSeats = row.seats.filter((s) => s.side === "right" || s.side === "back");

          if (row.isBackRow) {
            return (
              <div key="back" className="flex gap-1 mt-1">
                {row.seats.map((seat) => (
                  <SeatTile
                    key={seat.label}
                    isWindow={seat.isWindow}
                    isBack
                  />
                ))}
              </div>
            );
          }

          return (
            <div key={row.rowNumber} className="flex items-center gap-1">
              {/* Left pair */}
              <div className="flex gap-0.5">
                {leftSeats.map((seat) => (
                  <SeatTile key={seat.label} isWindow={seat.isWindow} />
                ))}
              </div>
              {/* Aisle */}
              <div className="w-4 shrink-0" />
              {/* Right seats */}
              <div className="flex gap-0.5">
                {rightSeats.map((seat) => (
                  <SeatTile key={seat.label} isWindow={seat.isWindow} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-2">
        {layout.totalSeats} seats total
      </p>
    </div>
  );
}

function SeatTile({ isWindow, isBack }: { isWindow: boolean; isBack?: boolean }) {
  return (
    <div
      className={cn(
        "rounded border transition-colors",
        isBack ? "w-5 h-4" : "w-4 h-4",
        isWindow
          ? "bg-blue-100 border-blue-300"
          : "bg-muted border-border"
      )}
    />
  );
}
