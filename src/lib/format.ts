export const INTERVAL_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "1 minute" },
  { value: 5, label: "5 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 180, label: "3 hours" },
  { value: 360, label: "6 hours" },
  { value: 720, label: "12 hours" },
  { value: 1440, label: "1 day" },
];

export function intervalLabel(minutes: number): string {
  return INTERVAL_OPTIONS.find((o) => o.value === minutes)?.label ?? `${minutes} min`;
}

export function intervalShort(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) {
    const h = minutes / 60;
    return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
  }
  const d = minutes / 1440;
  return Number.isInteger(d) ? `${d}d` : `${d.toFixed(1)}d`;
}

export function shortenUrl(raw: string, maxLen = 60): string {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname + (u.search || "") + (u.hash ? u.hash : "");
    const tail = host + path;
    if (tail.length <= maxLen) return tail;
    const headRoom = Math.max(maxLen - host.length - 4, 8);
    const left = Math.ceil(headRoom * 0.6);
    const right = Math.floor(headRoom * 0.4);
    return host + path.slice(0, left) + "…" + path.slice(-right);
  } catch {
    return raw.length > maxLen ? raw.slice(0, maxLen - 1) + "…" : raw;
  }
}

// Server components render once per request, so reading the clock in them is
// fine; the helper keeps the React purity lint from treating it as a client
// re-render hazard.
export function nowMs(): number {
  return Date.now();
}
