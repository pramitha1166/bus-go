import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  action?: ReactNode;
  className?: string;
}

export default function PageHeader({ title, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-6", className)}>
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      {action && <div>{action}</div>}
    </div>
  );
}
