"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ReportDownloadButtonProps {
  onDownload: () => Promise<void>;
  label?: string;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "outline" | "secondary";
}

export default function ReportDownloadButton({
  onDownload,
  label = "Download report",
  disabled = false,
  className,
  variant = "outline",
}: ReportDownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleClick = async () => {
    setLoading(true);
    try {
      await onDownload();
      toast({ title: "Downloaded successfully" });
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      disabled={disabled || loading}
      onClick={handleClick}
      className={cn("gap-2", className)}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      {label}
    </Button>
  );
}
