"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, MessageSquare, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SeatFillBar from "@/components/owner/SeatFillBar";
import type { OwnerSchedule } from "@/types/owner";

interface ScheduleRowProps {
  schedule: OwnerSchedule;
  busName: string;
  totalSeats: number;
}

export default function ScheduleRow({ schedule, busName, totalSeats }: ScheduleRowProps) {
  const departureDate = new Date(schedule.departureAt);
  const occupiedSeats = schedule.confirmedBookings + schedule.pendingBookings;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-0.5">
          <span className="truncate">{schedule.from}</span>
          <ArrowRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{schedule.to}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <span>{format(departureDate, "h:mm a")}</span>
          <span>·</span>
          <span className="truncate">{busName}</span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {schedule.confirmedBookings} / {totalSeats} seats confirmed
            </span>
            <span className="flex items-center gap-1">
              {schedule.smsNotificationSent ? (
                <span className="flex items-center gap-1 text-green-600">
                  <MessageSquare className="w-3 h-3" />
                  SMS sent
                </span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground/60">
                  <MessageSquare className="w-3 h-3" />
                  Pending
                </span>
              )}
            </span>
          </div>
          <SeatFillBar
            confirmed={schedule.confirmedBookings}
            pending={schedule.pendingBookings}
            total={totalSeats}
          />
        </div>
      </div>
      <Button variant="ghost" size="icon" asChild className="shrink-0">
        <Link href={`/portal/schedules/${schedule.id}`}>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </Button>
    </div>
  );
}
