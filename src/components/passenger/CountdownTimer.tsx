"use client";

import { useEffect, useState } from "react";

interface CountdownTimerProps {
  /** ISO string — booking.createdAt. Timer expires 15 minutes after this. */
  createdAt: string;
  onExpire?: () => void;
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function CountdownTimer({ createdAt, onExpire }: CountdownTimerProps) {
  const expiry = new Date(createdAt).getTime() + WINDOW_MS;

  function getRemainingMs() {
    return Math.max(0, expiry - Date.now());
  }

  const [remaining, setRemaining] = useState(getRemainingMs);
  const [expired, setExpired] = useState(remaining === 0);

  useEffect(() => {
    if (remaining === 0) {
      setExpired(true);
      onExpire?.();
      return;
    }

    const id = setInterval(() => {
      const left = getRemainingMs();
      setRemaining(left);
      if (left === 0) {
        setExpired(true);
        onExpire?.();
        clearInterval(id);
      }
    }, 1000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (expired) {
    return (
      <span className="text-destructive font-semibold">Expired</span>
    );
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <span className="tabular-nums font-semibold text-amber-600">
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
}
