"use client";

import { format } from "date-fns";
import { ArrowRight, Bus } from "lucide-react";
import { formatTime12h } from "@/lib/dateHelpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Schedule } from "@/types/passenger";

interface ScheduleCardProps {
  schedule: Schedule;
  onSelect: (schedule: Schedule) => void;
}

function SeatBadge({ available }: { available: number }) {
  if (available === 0)
    return <Badge variant="secondary" className="bg-slate-100 text-slate-500">Full</Badge>;
  if (available <= 5)
    return <Badge className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-50">{available} seats left</Badge>;
  if (available <= 10)
    return <Badge className="bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-50">{available} seats left</Badge>;
  return <Badge className="bg-green-50 text-green-600 border border-green-200 hover:bg-green-50">{available} seats left</Badge>;
}

export function ScheduleCard({ schedule, onSelect }: ScheduleCardProps) {
  const isFull = schedule.availableSeats === 0;

  return (
    <div
      onClick={() => !isFull && onSelect(schedule)}
      className={`bg-white border border-border rounded-xl p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4 transition-all duration-150 ${
        isFull
          ? "opacity-60 cursor-not-allowed"
          : "cursor-pointer hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
      }`}
    >
      {/* Bus info */}
      <div className="flex items-center gap-3 md:w-52 flex-shrink-0">
        <div className="bg-primary/10 rounded-lg p-2.5">
          <Bus className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{schedule.busName}</p>
          <p className="text-xs text-muted-foreground">{schedule.registrationNumber}</p>
        </div>
      </div>

      {/* Route — UPDATED: fromStation/toStation */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="font-medium text-foreground truncate">
          {schedule.fromStation.name}
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="font-medium text-foreground truncate">
          {schedule.toStation.name}
        </span>
      </div>

      {/* Departure time — FIXED: 12h format + journey date */}
      <div className="flex-shrink-0 text-left md:text-center md:min-w-[130px]">
        <p className="text-2xl font-bold text-foreground tabular-nums leading-none">
          {formatTime12h(schedule.departureTime)}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1 uppercase font-medium">
          {format(new Date(schedule.journeyDate), "EEEE, d MMM yyyy")}
        </p>
      </div>

      {/* Price */}
      <div className="flex-shrink-0 text-left md:text-right md:min-w-[100px]">
        <p className="text-lg font-bold text-foreground">
          LKR {Number(schedule.price).toLocaleString("en-LK")}
        </p>
        <p className="text-xs text-muted-foreground">per seat</p>
      </div>

      {/* Seats + action */}
      <div className="flex items-center gap-3 md:flex-col md:items-end flex-shrink-0">
        <SeatBadge available={schedule.availableSeats} />
        <Button
          size="sm"
          disabled={isFull}
          onClick={(e) => { e.stopPropagation(); onSelect(schedule); }}
          className="h-9 min-w-[110px] whitespace-nowrap"
        >
          {schedule.seatSelectionMode === "NONE" ? "Book" : "Select seat"}
        </Button>
      </div>
    </div>
  );
}
