"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Loader2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { Schedule } from "@/types/passenger";

const passengerSchema = z.object({
  passengerName: z.string().min(1, "Name is required"),
  passengerPhone: z
    .string()
    .regex(
      /^94\d{9}$/,
      "Phone must be in format: 94xxxxxxxxx (11 digits, starts with 94)"
    ),
});

export type PassengerFormValues = z.infer<typeof passengerSchema>;

interface PassengerFormProps {
  schedule: Schedule;
  selectedSeat: string | null; // UPDATED: label string or null (NONE-mode buses)
  onBack: () => void;
  onSubmit: (values: PassengerFormValues) => Promise<void>;
  submitError?: string | null;
}

export function PassengerForm({
  schedule,
  selectedSeat,
  onBack,
  onSubmit,
  submitError,
}: PassengerFormProps) {
  const form = useForm<PassengerFormValues>({
    resolver: zodResolver(passengerSchema),
    defaultValues: { passengerName: "", passengerPhone: "" },
  });

  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className="flex flex-col gap-5">
      {/* Journey summary */}
      <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          {/* UPDATED: use fromStation/toStation */}
          <span>{schedule.fromStation.name}</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span>{schedule.toStation.name}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-muted-foreground text-xs flex-wrap">
          <span>{schedule.departureTime}</span>
          {selectedSeat && (
            <>
              <span>·</span>
              <span>Seat {selectedSeat}</span>
            </>
          )}
          <span>·</span>
          <span className="font-medium text-foreground">
            LKR {Number(schedule.price).toLocaleString("en-LK")}
          </span>
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="passengerName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input placeholder="John Perera" {...field} className="h-11" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="passengerPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="94xxxxxxxxx"
                    type="tel"
                    {...field}
                    className="h-11"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {submitError && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {submitError}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={isSubmitting}
              className="flex-none h-11"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 h-11">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing…
                </>
              ) : (
                "Proceed to payment"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
