"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingConfirmCard } from "@/components/passenger/BookingConfirmCard";
import { getBooking } from "@/lib/api/passenger";
import type { Booking } from "@/types/passenger";

function SuccessIcon() {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-20 w-20"
      aria-hidden="true"
    >
      <circle cx="40" cy="40" r="40" fill="#dcfce7" />
      <path
        d="M24 40.5L34.5 51L56 30"
        stroke="#16a34a"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("order_id");

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError("No booking reference found.");
      setLoading(false);
      return;
    }
    getBooking(orderId)
      .then(setBooking)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load booking."))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <SuccessIcon />

      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Booking confirmed!</h1>
        <p className="text-muted-foreground">
          An SMS confirmation has been sent to your phone.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2 w-full">
          {error}
        </p>
      )}

      {booking && (
        <div className="w-full text-left">
          <BookingConfirmCard booking={booking} />
        </div>
      )}

      <Button
        onClick={() => router.push("/book")}
        className="h-11 px-8"
        variant={booking ? "outline" : "default"}
      >
        Book another bus
      </Button>
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white px-4 py-12">
      <div className="max-w-lg mx-auto">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <SuccessContent />
        </Suspense>
      </div>
    </main>
  );
}
