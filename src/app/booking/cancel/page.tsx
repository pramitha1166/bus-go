"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "@/components/passenger/CountdownTimer";
import { getBooking, initiatePayment, redirectToPayHere } from "@/lib/api/passenger";
import type { Booking } from "@/types/passenger";

function WarningIcon() {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-20 w-20"
      aria-hidden="true"
    >
      <circle cx="40" cy="40" r="40" fill="#fef3c7" />
      <path
        d="M40 26v18M40 52v2"
        stroke="#d97706"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CancelContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("order_id");

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setError("No booking reference found.");
      setLoading(false);
      return;
    }
    getBooking(orderId)
      .then((b) => {
        setBooking(b);
        if (b.status === "CANCELLED") setExpired(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load booking."))
      .finally(() => setLoading(false));
  }, [orderId]);

  async function handleRetryPayment() {
    if (!booking) return;
    setRetrying(true);
    try {
      const payment = await initiatePayment(booking.id);
      redirectToPayHere(payment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not initiate payment.");
      setRetrying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <WarningIcon />

      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Payment cancelled</h1>
        {!expired ? (
          <p className="text-muted-foreground">
            Your seat is still reserved for a few minutes. Complete your payment before it expires.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Your seat reservation has expired.
          </p>
        )}
      </div>

      {/* Countdown */}
      {booking && !expired && (
        <div className="bg-white border border-amber-200 rounded-xl px-6 py-4 w-full text-center space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Reservation expires in
          </p>
          <div className="text-3xl">
            <CountdownTimer
              createdAt={booking.createdAt}
              onExpire={() => setExpired(true)}
            />
          </div>
        </div>
      )}

      {/* Booking summary */}
      {booking && (
        <div className="bg-white border border-border rounded-xl p-4 w-full text-left space-y-2 text-sm">
          <p className="font-semibold text-foreground">
            {booking.schedule.origin} → {booking.schedule.destination}
          </p>
          <p className="text-muted-foreground">
            {format(new Date(booking.schedule.departureTime), "EEE, dd MMM yyyy · hh:mm a")}
          </p>
          <p className="text-muted-foreground">
            Seat {booking.seatNumber} ·{" "}
            <span className="font-medium text-foreground">
              LKR {Number(booking.schedule.price).toLocaleString("en-LK")}
            </span>
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2 w-full">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 w-full">
        {!expired && booking && (
          <Button
            onClick={handleRetryPayment}
            disabled={retrying}
            className="h-11 w-full"
          >
            {retrying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Redirecting…
              </>
            ) : (
              "Complete payment"
            )}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => router.push("/book")}
          className="h-11 w-full"
        >
          Choose a different seat
        </Button>
      </div>
    </div>
  );
}

export default function BookingCancelPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-white px-4 py-12">
      <div className="max-w-lg mx-auto">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <CancelContent />
        </Suspense>
      </div>
    </main>
  );
}
