"use client";

import React, { useRef, useCallback, KeyboardEvent, ClipboardEvent, ChangeEvent } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
}

export default function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  hasError = false,
  className,
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.split("").concat(Array(length).fill("")).slice(0, length);

  const focusAt = useCallback((index: number) => {
    const el = inputRefs.current[index];
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const handleChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    const newValue = newDigits.join("");
    onChange(newValue);

    if (char && index < length - 1) {
      focusAt(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const newDigits = [...digits];
      if (newDigits[index]) {
        newDigits[index] = "";
        onChange(newDigits.join(""));
      } else if (index > 0) {
        newDigits[index - 1] = "";
        onChange(newDigits.join(""));
        focusAt(index - 1);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusAt(index - 1);
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      focusAt(index + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted.padEnd(length, "").slice(0, length));
    const nextIndex = Math.min(pasted.length, length - 1);
    focusAt(nextIndex);
  };

  return (
    <div className={cn("flex gap-2 justify-center", className)}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] ?? ""}
          disabled={disabled}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            "w-10 h-12 text-center text-lg font-semibold rounded-md border-2 outline-none transition-all",
            "focus:border-primary focus:ring-2 focus:ring-primary/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            hasError
              ? "border-destructive bg-destructive/5 animate-shake"
              : "border-input bg-background",
          )}
        />
      ))}
    </div>
  );
}
