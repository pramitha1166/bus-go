"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import type { OwnerBooking } from "@/types/owner";

interface BookingsTableProps {
  bookings: OwnerBooking[];
  showPayment?: boolean;
  emptyMessage?: string;
}

type SortKey = "seatNumber" | "createdAt";
type SortDir = "asc" | "desc";

export default function BookingsTable({
  bookings,
  showPayment = false,
  emptyMessage = "No bookings found.",
}: BookingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("seatNumber");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = [...bookings].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortKey === "seatNumber") return (a.seatNumber - b.seatNumber) * mul;
    return (
      (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * mul
    );
  });

  if (!bookings.length) {
    return <EmptyState title={emptyMessage} className="py-10" />;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => toggleSort("seatNumber")}
                >
                  Seat
                  <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </TableHead>
              <TableHead>Passenger</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => toggleSort("createdAt")}
                >
                  Booked At
                  <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </TableHead>
              {showPayment && <TableHead>Amount</TableHead>}
              <TableHead>Payment Ref</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.seatNumber}</TableCell>
                <TableCell>{b.passengerName}</TableCell>
                <TableCell className="font-mono text-sm">
                  {b.passengerPhone}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(b.createdAt), "dd MMM, h:mm a")}
                </TableCell>
                {showPayment && (
                  <TableCell className="font-medium">
                    {b.payment ? `LKR ${b.payment.amount.toLocaleString()}` : "—"}
                  </TableCell>
                )}
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {b.payment?.gatewayReference ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {sorted.map((b) => (
          <div key={b.id} className="border rounded-lg p-3 bg-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">Seat {b.seatNumber}</span>
              <StatusBadge status={b.status} />
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Passenger</span>
                <span className="font-medium">{b.passengerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-mono">{b.passengerPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Booked</span>
                <span>{format(new Date(b.createdAt), "dd MMM, h:mm a")}</span>
              </div>
              {showPayment && b.payment && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">
                    LKR {b.payment.amount.toLocaleString()}
                  </span>
                </div>
              )}
              {b.payment?.gatewayReference && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ref</span>
                  <span className="font-mono text-xs">
                    {b.payment.gatewayReference}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
