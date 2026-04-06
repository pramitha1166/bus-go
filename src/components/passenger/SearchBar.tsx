"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
// UPDATED: use shared StationSelect
import { StationSelect } from "@/components/shared/StationSelect";
import { cn } from "@/lib/utils";
import type { StationSummary } from "@/types/passenger";

interface SearchBarProps {
  // UPDATED: passes station IDs
  onSearch: (fromStationId: string, toStationId: string, date: string) => void;
  isLoading?: boolean;
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [fromStation, setFromStation] = useState<StationSummary | null>(null);
  const [toStation, setToStation]     = useState<StationSummary | null>(null);
  const [date, setDate]               = useState<Date>(new Date());
  const [calOpen, setCalOpen]         = useState(false);

  function handleSwap() {
    const tmp = fromStation;
    setFromStation(toStation);
    setToStation(tmp);
  }

  function handleSearch() {
    onSearch(
      fromStation?.id ?? "",
      toStation?.id   ?? "",
      format(date, "yyyy-MM-dd")
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-2 md:items-end bg-white border border-border rounded-xl p-3 shadow-sm">
      {/* From station */}
      <div className="flex-1">
        <StationSelect
          label="From"
          placeholder="Origin station"
          value={fromStation}
          onChange={setFromStation}
        />
      </div>

      {/* Swap */}
      <button
        type="button"
        onClick={handleSwap}
        className="self-end mb-0.5 md:mb-0 p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Swap from and to"
      >
        ⇄
      </button>

      {/* To station */}
      <div className="flex-1">
        <StationSelect
          label="To"
          placeholder="Destination station"
          value={toStation}
          onChange={setToStation}
        />
      </div>

      {/* Divider */}
      <div className="hidden md:block w-px h-10 bg-border self-end mb-0.5" />

      {/* Date picker */}
      <div className="flex-shrink-0 md:min-w-[160px]">
        <label className="text-xs text-muted-foreground font-medium mb-1 block pl-1">Date</label>
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start text-left font-normal h-11 bg-muted/40 hover:bg-muted/60",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              {date ? format(date, "EEE, dd MMM") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => { if (d) { setDate(d); setCalOpen(false); } }}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Search button */}
      <Button
        onClick={handleSearch}
        disabled={isLoading}
        className="h-11 px-6 md:self-end"
      >
        <Search className="h-4 w-4 mr-2" />
        {isLoading ? "Searching…" : "Search"}
      </Button>
    </div>
  );
}
