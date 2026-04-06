import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/types/owner";

interface StatusBadgeProps {
  status: BookingStatus;
  className?: string;
}

const config: Record<BookingStatus, { label: string; classes: string }> = {
  CONFIRMED: {
    label: "Confirmed",
    classes: "bg-green-100 text-green-700 border-green-200",
  },
  PENDING: {
    label: "Pending",
    classes: "bg-amber-100 text-amber-700 border-amber-200",
  },
  CANCELLED: {
    label: "Cancelled",
    classes: "bg-red-100 text-red-700 border-red-200",
  },
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, classes } = config[status] ?? config.PENDING;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        classes,
        className
      )}
    >
      {label}
    </span>
  );
}
