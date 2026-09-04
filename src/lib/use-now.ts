"use client";

import { useSyncExternalStore } from "react";

// A ticking clock as an external store, so a component can re-render every
// second without setting state from inside an effect. Snapshots are rounded
// to the tick so React sees a stable value between ticks; the server renders
// null and the client fills it in after hydration.
const subscribers = new Map<number, (onChange: () => void) => () => void>();

function subscriberFor(intervalMs: number) {
  let sub = subscribers.get(intervalMs);
  if (!sub) {
    sub = (onChange) => {
      const id = setInterval(onChange, intervalMs);
      return () => clearInterval(id);
    };
    subscribers.set(intervalMs, sub);
  }
  return sub;
}

export function useNow(intervalMs = 1000): number | null {
  return useSyncExternalStore(
    subscriberFor(intervalMs),
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => null,
  );
}
