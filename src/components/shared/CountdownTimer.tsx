"use client";

import { useEffect, useState } from "react";

interface CountdownTimerProps {
  seconds: number;
  onExpire?: () => void;
  className?: string;
}

export default function CountdownTimer({
  seconds,
  onExpire,
  className,
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) {
      onExpire?.();
      return;
    }
    const timer = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, onExpire]);

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const display = `${m}:${String(s).padStart(2, "0")}`;

  return (
    <span className={className}>
      {remaining > 0 ? display : "0:00"}
    </span>
  );
}
