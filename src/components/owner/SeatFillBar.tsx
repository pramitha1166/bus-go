import { cn } from "@/lib/utils";

interface SeatFillBarProps {
  confirmed: number;
  pending: number;
  total: number;
  className?: string;
}

export default function SeatFillBar({
  confirmed,
  pending,
  total,
  className,
}: SeatFillBarProps) {
  const confirmedPct = total > 0 ? Math.round((confirmed / total) * 100) : 0;
  const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0;

  return (
    <div className={cn("w-full h-1.5 rounded-full bg-muted overflow-hidden flex", className)}>
      <div
        className="h-full bg-green-500 transition-all"
        style={{ width: `${confirmedPct}%` }}
      />
      <div
        className="h-full bg-amber-400 transition-all"
        style={{ width: `${pendingPct}%` }}
      />
    </div>
  );
}
