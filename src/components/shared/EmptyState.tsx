import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-4 text-muted-foreground/40">{icon}</div>
      )}
      <p className="text-base font-medium text-foreground mb-1">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mb-6">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
