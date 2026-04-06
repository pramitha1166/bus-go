"use client";

import { cn } from "@/lib/utils";

const DAYS = [
  { key: "MON", label: "Mon" },
  { key: "TUE", label: "Tue" },
  { key: "WED", label: "Wed" },
  { key: "THU", label: "Thu" },
  { key: "FRI", label: "Fri" },
  { key: "SAT", label: "Sat" },
  { key: "SUN", label: "Sun" },
] as const;

export type DayKey = typeof DAYS[number]["key"];

interface ActiveDaysSelectorProps {
  value: DayKey[];
  onChange: (days: DayKey[]) => void;
  error?: string;
}

export function ActiveDaysSelector({ value, onChange, error }: ActiveDaysSelectorProps) {
  function toggle(day: DayKey) {
    const next = value.includes(day)
      ? value.filter((d) => d !== day)
      : [...value, day];
    // Always keep at least one day
    if (next.length === 0) return;
    onChange(next);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1 flex-wrap">
        {DAYS.map(({ key, label }) => {
          const active = value.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={cn(
                "h-8 min-w-[2.75rem] px-2 rounded-full text-xs font-semibold border transition-all duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:border-primary/40"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

/** Converts an array of DayKey[] to the comma-separated string stored in DB */
export function daysToString(days: DayKey[]): string {
  return days.join(",");
}

/** Parses a comma-separated days string back to DayKey[] */
export function stringToDays(str: string): DayKey[] {
  if (!str) return ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  return str.split(",").filter(Boolean) as DayKey[];
}

export const ALL_DAYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
