export const INTERVAL_OPTIONS: { value: number; label: string }[] = [
  { value: 15, label: "15 minut" },
  { value: 30, label: "30 minut" },
  { value: 60, label: "1 hodina" },
  { value: 180, label: "3 hodiny" },
  { value: 360, label: "6 hodin" },
  { value: 720, label: "12 hodin" },
  { value: 1440, label: "1 den" },
];

export function intervalLabel(minutes: number): string {
  return INTERVAL_OPTIONS.find((o) => o.value === minutes)?.label ?? `${minutes} min`;
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
