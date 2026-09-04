import { availabilityTone } from "@/lib/product-data";

// A text value (availability above all) has no chart, but its history is the
// one thing worth knowing before buying: how long it tends to stay in stock,
// and how long it was gone last time.
type ChangeLike = { oldValue: string; newValue: string; detectedAt: Date };

type Segment = { value: string; from: number; to: number; live: boolean };

const TONE_BAR = {
  good: "bg-emerald-500",
  bad: "bg-red-400",
  neutral: "bg-neutral-400",
} as const;

export function AvailabilityTimeline({
  changes,
  current,
  since,
  now,
  colored,
}: {
  changes: ChangeLike[]; // newest first, as stored
  current: string | null;
  since: Date;
  now: number;
  colored: boolean;
}) {
  const chronological = [...changes].reverse();
  const segments: Segment[] = [];
  let start = since.getTime();
  for (const c of chronological) {
    segments.push({ value: c.oldValue, from: start, to: c.detectedAt.getTime(), live: false });
    start = c.detectedAt.getTime();
  }
  const last = current ?? chronological[chronological.length - 1]?.newValue;
  if (last) segments.push({ value: last, from: start, to: now, live: true });
  if (segments.length === 0) return null;

  const total = Math.max(1, now - segments[0].from);

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 pt-3 pb-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">History</div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        {segments.map((s, i) => (
          <div
            key={i}
            title={`${s.value} · ${formatSpan(s.to - s.from)}`}
            style={{ width: `${Math.max(1.5, ((s.to - s.from) / total) * 100)}%` }}
            className={
              (colored ? TONE_BAR[availabilityTone(s.value)] : i % 2 ? "bg-neutral-400" : "bg-neutral-300 dark:bg-neutral-600") +
              " border-r border-white dark:border-neutral-900 last:border-0"
            }
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {[...segments].reverse().map((s, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3">
            <span className="truncate">
              {colored && (
                <span
                  className={"inline-block h-2 w-2 rounded-full mr-2 align-middle " + TONE_BAR[availabilityTone(s.value)]}
                />
              )}
              {s.value}
            </span>
            <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
              {formatDate(s.from)} → {s.live ? "now" : formatDate(s.to)} · {formatSpan(s.to - s.from)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatSpan(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
