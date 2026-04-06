import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: string;
  loading?: boolean;
  className?: string;
}

export default function StatsCard({
  label,
  value,
  icon,
  trend,
  loading = false,
  className,
}: StatsCardProps) {
  if (loading) {
    return (
      <div className={cn("bg-card border rounded-xl p-4 space-y-3", className)}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-card border rounded-xl p-4 flex flex-col gap-1",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        {icon && (
          <span className="text-muted-foreground/50">{icon}</span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {trend && (
        <p className="text-xs text-muted-foreground">{trend}</p>
      )}
    </div>
  );
}
