"use client";

import Link from "next/link";
import { Bus, Calendar, Users, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OwnerBus } from "@/types/owner";

interface BusCardProps {
  bus: OwnerBus;
}

export default function BusCard({ bus }: BusCardProps) {
  const totalConfirmed = bus.schedules.reduce(
    (sum, s) => sum + s.confirmedBookings,
    0
  );

  return (
    <div className="bg-card border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bus className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">{bus.name}</p>
            <p className="text-xs text-muted-foreground">{bus.regNumber}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
            <Users className="w-3 h-3" />
          </div>
          <p className="text-sm font-semibold">{bus.totalSeats}</p>
          <p className="text-xs text-muted-foreground">Seats</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
            <Calendar className="w-3 h-3" />
          </div>
          <p className="text-sm font-semibold">{bus.schedules.length}</p>
          <p className="text-xs text-muted-foreground">Journeys</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
            <Ticket className="w-3 h-3" />
          </div>
          <p className="text-sm font-semibold">{totalConfirmed}</p>
          <p className="text-xs text-muted-foreground">Bookings</p>
        </div>
      </div>

      <Button variant="outline" size="sm" className="w-full" asChild>
        <Link href={`/portal/schedules?busId=${bus.id}`}>View schedules</Link>
      </Button>
    </div>
  );
}
