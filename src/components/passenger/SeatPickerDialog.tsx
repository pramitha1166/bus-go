"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowRight, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { SeatGrid, SeatLegend } from "./SeatGrid";
import { PassengerForm, type PassengerFormValues } from "./PassengerForm";
import { getSeats, createBooking, initiatePayment, redirectToPayHere } from "@/lib/api/passenger";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { Schedule, Seat } from "@/types/passenger";

type Step = "seat" | "details";

interface SeatPickerDialogProps {
  schedule: Schedule | null;
  journeyDate: string; // YYYY-MM-DD
  open: boolean;
  onClose: () => void;
}

function JourneySummaryLine({ schedule }: { schedule: Schedule }) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-sm">
      {/* UPDATED: fromStation/toStation */}
      <span className="font-semibold">{schedule.fromStation.name}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="font-semibold">{schedule.toStation.name}</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">{schedule.departureTime}</span>
      <span className="text-muted-foreground">·</span>
      <span className="font-semibold text-primary">
        LKR {Number(schedule.price).toLocaleString("en-LK")}
      </span>
    </div>
  );
}

function SeatPickerContent({
  schedule,
  journeyDate,
  onClose,
}: {
  schedule: Schedule;
  journeyDate: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("seat");
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seatsLoading, setSeatsLoading] = useState(true);
  const [seatsError, setSeatsError] = useState<string | null>(null);
  // UPDATED: string label or null
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mode = schedule.seatSelectionMode;
  const isLuxury = schedule.busType === "LUXURY";

  async function loadSeats() {
    setSeatsLoading(true);
    setSeatsError(null);
    try {
      const data = await getSeats(schedule.id, journeyDate);
      setSeats(data);
    } catch (err) {
      setSeatsError(err instanceof Error ? err.message : "Failed to load seat map.");
    } finally {
      setSeatsLoading(false);
    }
  }

  useEffect(() => {
    if (mode !== "NONE") {
      loadSeats();
    } else {
      setSeatsLoading(false);
    }
    setStep("seat");
    setSelectedSeat(null);
    setSubmitError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule.id]);

  const allTaken =
    mode !== "NONE" &&
    !seatsLoading &&
    !seatsError &&
    seats.every((s) => s.status !== "available");

  async function handleFormSubmit(values: PassengerFormValues) {
    setSubmitError(null);
    try {
      const booking = await createBooking({
        scheduleId:     schedule.id,
        journeyDate,
        seatLabel:      selectedSeat ?? undefined,
        passengerName:  values.passengerName,
        passengerPhone: values.passengerPhone,
      });
      const payment = await initiatePayment(booking.id);
      redirectToPayHere(payment);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      const isSeatTaken =
        message.toLowerCase().includes("already booked") ||
        message.toLowerCase().includes("seat");
      setSubmitError(
        isSeatTaken
          ? "This seat was just taken. Please select another seat."
          : message
      );
      if (isSeatTaken && mode !== "NONE") {
        setStep("seat");
        setSelectedSeat(null);
        await loadSeats();
      }
    }
  }

  // ── NONE mode (Normal bus) — no seat grid ──────────────────────────────────
  if (mode === "NONE") {
    if (step === "seat") {
      return (
        <div className="flex flex-col gap-4 px-1">
          <JourneySummaryLine schedule={schedule} />
          <p className="text-xs text-muted-foreground">{schedule.busName} · {schedule.registrationNumber}</p>
          <Separator />
          <div className="rounded-xl bg-muted/40 border p-4 text-center space-y-1">
            <p className="font-medium text-sm">No seat selection for this bus</p>
            <p className="text-sm text-muted-foreground">
              {schedule.availableSeats} seats remaining.
            </p>
          </div>
          <Button className="w-full h-11" onClick={() => setStep("details")}>
            Continue
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4 px-1">
        <JourneySummaryLine schedule={schedule} />
        <Separator />
        <PassengerForm
          schedule={schedule}
          selectedSeat={null}
          onBack={() => { setStep("seat"); setSubmitError(null); }}
          onSubmit={handleFormSubmit}
          submitError={submitError}
        />
      </div>
    );
  }

  // ── OPTIONAL / REQUIRED mode ───────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 px-1">
      {/* Journey summary */}
      <div>
        <JourneySummaryLine schedule={schedule} />
        <p className="text-xs text-muted-foreground mt-0.5">
          {schedule.busName} · {schedule.registrationNumber}
        </p>
      </div>

      <Separator />

      {/* Step: Seat */}
      {step === "seat" && (
        <>
          <SeatLegend showWindow={isLuxury} />

          {seatsLoading && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Loading seat map…</span>
            </div>
          )}

          {seatsError && !seatsLoading && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-destructive">{seatsError}</p>
              <Button variant="outline" size="sm" onClick={loadSeats}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try again
              </Button>
            </div>
          )}

          {allTaken && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="font-semibold text-foreground">This journey is fully booked</p>
              <p className="text-sm text-muted-foreground">
                All seats are taken for this schedule.
              </p>
              <Button variant="outline" onClick={onClose}>
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
            </div>
          )}

          {!seatsLoading && !seatsError && !allTaken && (
            <SeatGrid
              seats={seats}
              selectedSeat={selectedSeat}
              onSeatSelect={setSelectedSeat}
              highlightWindows={isLuxury}
            />
          )}

          {!seatsLoading && !seatsError && !allTaken && (
            <div className="border-t border-border pt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {selectedSeat ? (
                    <span className="text-foreground font-medium">
                      Seat {selectedSeat} selected · LKR{" "}
                      {Number(schedule.price).toLocaleString("en-LK")}
                    </span>
                  ) : (
                    "Select a seat to continue"
                  )}
                </p>
                <Button
                  // REQUIRED: must have seat; OPTIONAL: can proceed without
                  disabled={mode === "REQUIRED" && !selectedSeat}
                  onClick={() => setStep("details")}
                  className="h-10 px-5"
                >
                  Continue to details
                </Button>
              </div>
              {/* OPTIONAL: skip seat selection */}
              {mode === "OPTIONAL" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => { setSelectedSeat(null); setStep("details"); }}
                >
                  Skip seat selection
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* Step: Details */}
      {step === "details" && (
        <PassengerForm
          schedule={schedule}
          selectedSeat={selectedSeat}
          onBack={() => { setStep("seat"); setSubmitError(null); }}
          onSubmit={handleFormSubmit}
          submitError={submitError}
        />
      )}
    </div>
  );
}

export function SeatPickerDialog({ schedule, journeyDate, open, onClose }: SeatPickerDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (!schedule) return null;

  const title = schedule.seatSelectionMode === "NONE" ? "Book your seat" : "Pick your seat";

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <SeatPickerContent schedule={schedule} journeyDate={journeyDate} onClose={onClose} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] overflow-y-auto rounded-t-2xl px-4 pb-6"
      >
        <SheetHeader className="mb-2">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <SeatPickerContent schedule={schedule} journeyDate={journeyDate} onClose={onClose} />
      </SheetContent>
    </Sheet>
  );
}
