// A watch that keeps failing is slowed down rather than switched off: a shop
// that is down for half an hour should not need a person to notice and press
// resume. The first successful check puts the watch back on its own interval.
export const FAIL_SLOWDOWN_THRESHOLD = 5;

export function effectiveIntervalMinutes(intervalMinutes: number, failStreak: number): number {
  if (failStreak >= FAIL_SLOWDOWN_THRESHOLD * 2) return Math.max(intervalMinutes, 60);
  if (failStreak >= FAIL_SLOWDOWN_THRESHOLD) return Math.max(intervalMinutes, 15);
  return intervalMinutes;
}

type Schedulable = {
  lastCheckedAt: Date | null;
  intervalMinutes: number;
  failStreak: number;
  snoozedUntil: Date | null;
};

export function isDue(w: Schedulable, now = Date.now()): boolean {
  // Snoozed means "not before this date"; it wakes on its own afterwards.
  if (w.snoozedUntil && w.snoozedUntil.getTime() > now) return false;
  if (!w.lastCheckedAt) return true;
  const elapsed = now - w.lastCheckedAt.getTime();
  return elapsed >= effectiveIntervalMinutes(w.intervalMinutes, w.failStreak) * 60_000 - 30_000;
}
