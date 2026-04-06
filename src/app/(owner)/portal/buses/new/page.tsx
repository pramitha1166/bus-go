"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createBus } from "@/lib/api/owner";
import { calculateTotalSeats } from "@/lib/seatLayout";
import { BusTypeSelector } from "@/components/owner/BusTypeSelector";
import { SeatLayoutPreview } from "@/components/owner/SeatLayoutPreview";
import type { BusType } from "@/types/owner";

const busSchema = z.object({
  name:      z.string().min(1, "Bus name is required"),
  regNumber: z.string().min(1, "Registration number is required"),
  rows: z
    .number({ invalid_type_error: "Must be a number" })
    .int()
    .min(5, "Minimum 5 rows")
    .max(20, "Maximum 20 rows"),
});

type BusFormValues = z.infer<typeof busSchema>;

export default function AddBusPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [selectedBusType, setSelectedBusType] = useState<BusType | null>(null);
  const [busTypeError, setBusTypeError]         = useState<string | null>(null);
  const [submitError, setSubmitError]           = useState<string | null>(null);

  const form = useForm<BusFormValues>({
    resolver: zodResolver(busSchema),
    defaultValues: { name: "", regNumber: "", rows: 9 },
  });

  const rows       = form.watch("rows") ?? 9;
  const totalSeats = selectedBusType ? calculateTotalSeats(selectedBusType, rows) : null;

  const handleSubmit = async (values: BusFormValues) => {
    if (!selectedBusType) {
      setBusTypeError("Please select a bus type.");
      return;
    }
    setBusTypeError(null);
    setSubmitError(null);

    try {
      await createBus({
        name:      values.name,
        regNumber: values.regNumber,
        busType:   selectedBusType,
        rows:      values.rows,
      });
      toast({
        title: "Bus added successfully.",
        description: "You can now add schedules for this bus.",
      });
      router.push("/portal");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create bus.";
      if (msg.includes("registration number")) {
        setSubmitError("This registration number is already registered.");
      } else {
        setSubmitError(msg);
      }
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-card border rounded-2xl p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold mb-1">Add bus</h1>
          <p className="text-sm text-muted-foreground">
            Register a new bus on the platform. You can add schedules for it afterwards.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
            {/* Bus name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bus name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Araliya Express" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Registration number */}
            <FormField
              control={form.control}
              name="regNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registration number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. NA-1234" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Bus type selector */}
            <div className="space-y-2">
              <Label>Bus type</Label>
              <BusTypeSelector
                value={selectedBusType}
                onChange={(t) => { setSelectedBusType(t); setBusTypeError(null); }}
              />
              {busTypeError && (
                <p className="text-xs text-destructive">{busTypeError}</p>
              )}
            </div>

            {/* Number of rows + live seat calculator */}
            <FormField
              control={form.control}
              name="rows"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of seat rows (excluding back row)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={5}
                      max={20}
                      placeholder="9"
                      {...field}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? undefined : Number(e.target.value)
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                  {selectedBusType && totalSeats !== null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Total seats:{" "}
                      <span className="font-semibold text-foreground">{totalSeats}</span>
                    </p>
                  )}
                </FormItem>
              )}
            />

            {/* Seat layout preview */}
            {selectedBusType && rows >= 1 && rows <= 20 && (
              <div className="border rounded-xl p-4 bg-muted/30 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Seat layout preview
                </p>
                <SeatLayoutPreview busType={selectedBusType} rows={rows} />
              </div>
            )}

            {submitError && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {submitError}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Add bus
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
