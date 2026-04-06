"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { toggleSchedule } from "@/lib/api/owner";
import { useToast } from "@/hooks/use-toast";

interface ScheduleToggleProps {
  scheduleId: string;
  isActive: boolean;
  onToggle?: (newState: boolean) => void;
}

export function ScheduleToggle({ scheduleId, isActive, onToggle }: ScheduleToggleProps) {
  const { toast } = useToast();
  const [checked, setChecked] = useState(isActive);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function doToggle() {
    setLoading(true);
    try {
      const res = await toggleSchedule(scheduleId);
      setChecked(res.isActive);
      onToggle?.(res.isActive);
      toast({
        title: res.isActive ? "Schedule activated" : "Schedule paused",
      });
    } catch (err) {
      toast({
        title: "Failed to update schedule",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleCheckedChange(next: boolean) {
    if (!next) {
      // Deactivating — show confirmation first
      setConfirmOpen(true);
    } else {
      doToggle();
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Switch
            id={`toggle-${scheduleId}`}
            checked={checked}
            onCheckedChange={handleCheckedChange}
            disabled={loading}
          />
        )}
        <Label
          htmlFor={`toggle-${scheduleId}`}
          className="text-xs cursor-pointer select-none"
        >
          {checked ? "Active" : "Paused"}
        </Label>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Pause this schedule?"
        description="Pausing this schedule will cancel all pending bookings for future dates. Are you sure?"
        confirmLabel="Pause schedule"
        destructive
        onConfirm={() => {
          setConfirmOpen(false);
          doToggle();
        }}
      />
    </>
  );
}
