"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { X, ChevronsUpDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StationSummary } from "@/types/passenger";

interface StationSelectProps {
  label: string;
  placeholder?: string;
  value: StationSummary | null;
  onChange: (station: StationSummary | null) => void;
  className?: string;
}

// Module-level cache — shared across all instances, persists for the session
let stationCache: StationSummary[] | null = null;

async function loadAllStations(): Promise<StationSummary[]> {
  if (stationCache) return stationCache;
  const res = await fetch("/api/stations");
  if (!res.ok) return [];
  const data = await res.json();
  // API returns a bare array: NextResponse.json(stations)
  stationCache = (Array.isArray(data) ? data : (data.stations ?? [])) as StationSummary[];
  return stationCache;
}

// Highlight matching characters in text
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-primary rounded-[2px] font-semibold not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function StationSelect({
  label,
  placeholder = "Search station…",
  value,
  onChange,
  className,
}: StationSelectProps) {
  const [allStations, setAllStations]   = useState<StationSummary[]>(stationCache ?? []);
  const [query, setQuery]               = useState("");
  const [open, setOpen]                 = useState(false);
  const [loading, setLoading]           = useState(false);
  const wrapperRef                      = useRef<HTMLDivElement>(null);

  // Load all stations on mount (or immediately if already cached)
  useEffect(() => {
    if (stationCache) {
      setAllStations(stationCache);
      return;
    }
    setLoading(true);
    loadAllStations().then((stations) => {
      setAllStations(stations);
      setLoading(false);
    });
  }, []);

  // Client-side filtered + grouped results
  const grouped = useMemo<Map<string, StationSummary[]>>(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? allStations.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.district.toLowerCase().includes(q) ||
            s.province.toLowerCase().includes(q)
        )
      : allStations;

    const map = new Map<string, StationSummary[]>();
    for (const s of filtered) {
      if (!map.has(s.province)) map.set(s.province, []);
      map.get(s.province)!.push(s);
    }
    return map;
  }, [allStations, query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleOpen() {
    setOpen(true);
    setQuery("");
  }

  function handleSelect(station: StationSummary) {
    onChange(station);
    setOpen(false);
    setQuery("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    setQuery("");
  }

  const totalResults = Array.from(grouped.values()).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <label className="text-xs text-muted-foreground font-medium mb-1 block pl-1">
        {label}
      </label>

      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          "w-full flex items-center gap-2 h-11 rounded-lg border border-input bg-muted/40 px-3 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring text-left",
          open && "ring-1 ring-ring border-ring"
        )}
      >
        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className={cn("flex-1 truncate", !value && "text-muted-foreground")}>
          {value ? value.name : placeholder}
        </span>
        {value ? (
          <X
            className="h-4 w-4 text-muted-foreground hover:text-foreground shrink-0"
            onClick={handleClear}
          />
        ) : (
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] rounded-lg border bg-popover shadow-md overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to filter…"
              className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Results */}
          <div className="max-h-64 overflow-y-auto">
            {loading && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Loading stations…
              </p>
            )}

            {!loading && totalResults === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No stations found.
              </p>
            )}

            {!loading &&
              Array.from(grouped.entries()).map(([province, stations]) => (
                <div key={province}>
                  {/* Province group header — non-selectable */}
                  <div className="px-3 py-1.5 bg-muted/50 border-b border-t first:border-t-0">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {province} Province
                    </p>
                  </div>

                  {stations.map((station) => (
                    <button
                      key={station.id}
                      type="button"
                      onClick={() => handleSelect(station)}
                      className={cn(
                        "w-full flex flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-accent transition-colors",
                        value?.id === station.id && "bg-accent"
                      )}
                    >
                      <span className="text-sm font-medium leading-tight">
                        <Highlight text={station.name} query={query} />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        <Highlight text={station.district} query={query} /> · {station.district} District
                      </span>
                    </button>
                  ))}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
