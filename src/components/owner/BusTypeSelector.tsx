"use client";

import { cn } from "@/lib/utils";
import type { BusType } from "@/types/owner";

interface BusTypeOption {
  value: BusType;
  label: string;
  description: string;
  seating: string;
}

const BUS_TYPES: BusTypeOption[] = [
  {
    value: "NORMAL",
    label: "Normal",
    description: "No seat booking",
    seating: "2+3 seating",
  },
  {
    value: "SEMI_LUXURY",
    label: "Semi-Luxury",
    description: "Optional seat booking",
    seating: "2+2 seating",
  },
  {
    value: "LUXURY",
    label: "Luxury (AC)",
    description: "Seat booking required",
    seating: "2+2 seating, window seats",
  },
  {
    value: "EXPRESSWAY",
    label: "Expressway",
    description: "Seat booking required",
    seating: "2+2 seating",
  },
];

interface BusTypeSelectorProps {
  value: BusType | null;
  onChange: (type: BusType) => void;
}

export function BusTypeSelector({ value, onChange }: BusTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {BUS_TYPES.map((type) => {
        const selected = value === type.value;
        return (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange(type.value)}
            className={cn(
              "flex flex-col gap-1 rounded-xl border-2 p-3 text-left transition-all duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
            )}
          >
            <span
              className={cn(
                "text-sm font-semibold leading-tight",
                selected ? "text-primary" : "text-foreground"
              )}
            >
              {type.label}
            </span>
            <span className="text-xs text-muted-foreground leading-snug">
              {type.seating}
            </span>
            <span
              className={cn(
                "text-xs font-medium leading-snug",
                selected ? "text-primary/80" : "text-muted-foreground/70"
              )}
            >
              {type.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
