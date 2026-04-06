"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface CrowdLevelBarProps {
  confirmed: number;
  totalSeats: number;
  pending?: number;
}

function getLabel(pct: number): string {
  if (pct === 0)   return "Empty";
  if (pct < 0.5)   return "Filling up";
  if (pct < 0.85)  return "Almost full";
  return "Full";
}

function getColor(pct: number): string {
  if (pct < 0.5)   return "bg-green-500";
  if (pct < 0.85)  return "bg-amber-500";
  return "bg-red-500";
}

export function CrowdLevelBar({ confirmed, totalSeats, pending = 0 }: CrowdLevelBarProps) {
  const total = Math.max(1, totalSeats);
  const confirmedPct = Math.min(100, Math.round((confirmed / total) * 100));
  const pendingPct   = Math.min(100 - confirmedPct, Math.round((pending / total) * 100));
  const filledPct    = confirmedPct + pendingPct;
  const label        = getLabel(confirmed / total);
  const color        = getColor(confirmed / total);

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold tabular-nums">
            {confirmed}
            <span className="text-lg font-medium text-muted-foreground">
              /{totalSeats}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">passengers boarded</p>
        </div>
        <span
          className={cn(
            "text-sm font-semibold px-2.5 py-1 rounded-full border",
            filledPct === 0 && "bg-muted text-muted-foreground border-border",
            filledPct > 0 && filledPct < 50  && "bg-green-50  text-green-700  border-green-200",
            filledPct >= 50 && filledPct < 85 && "bg-amber-50  text-amber-700  border-amber-200",
            filledPct >= 85 && "bg-red-50 text-red-700 border-red-200"
          )}
        >
          {label}
        </span>
      </div>

      {/* Stacked bar: confirmed + pending */}
      <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("absolute left-0 top-0 h-full transition-all", color)}
          style={{ width: `${confirmedPct}%` }}
        />
        <div
          className="absolute top-0 h-full bg-amber-300 transition-all"
          style={{ left: `${confirmedPct}%`, width: `${pendingPct}%` }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
          {confirmed} confirmed
        </span>
        {pending > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            {pending} pending
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-secondary border border-border" />
          {totalSeats - confirmed - pending} available
        </span>
      </div>
    </div>
  );
}
