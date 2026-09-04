import { db } from "@/lib/db";
import { fetchAndExtract, type ExtractResult } from "@/lib/extract";
import {
  sendChangeNotification,
  sendFailingNotification,
  sendSelectorGoneNotification,
} from "@/lib/email";
import { evaluateTransition, type Condition, type ConditionType } from "@/lib/condition";
import { isNumericValue, parseNumber } from "@/lib/numeric";
import { FAIL_SLOWDOWN_THRESHOLD, effectiveIntervalMinutes } from "@/lib/schedule";
import { pushTo } from "@/lib/push";
import { availabilityTone } from "@/lib/product-data";

export type ProcessInput = {
  id: string;
  userId: string;
  url: string;
  selector: string;
  label: string;
  notifyEmail: string;
  lastValue: string | null;
  lastHash: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
  conditionType: string;
  conditionValue: string | null;
  intervalMinutes: number;
  failStreak: number;
};

export type ProcessResult = "changed" | "same" | "error";

// Cloud-side check. Remembers whether the shop refused our datacenter IP, so
// the app knows which watches only the local agent can serve.
export async function processWatch(watch: ProcessInput): Promise<ProcessResult> {
  const t0 = Date.now();
  const result = await fetchAndExtract(watch.url, watch.selector, {
    priceFallback: isNumericValue(watch.lastValue),
  });
  const cloudBlocked =
    !result.ok && result.kind === "fetch" && /^HTTP (403|429|503)\b/.test(result.error);
  return applyResult(watch, result, Date.now() - t0, { cloudBlocked });
}

// Split out so the local agent can report a page it fetched itself: extraction
// and every side effect still happen here, the agent only supplies the HTML.
export async function applyResult(
  watch: ProcessInput,
  result: ExtractResult,
  durationMs: number,
  extra: { cloudBlocked?: boolean } = {},
): Promise<ProcessResult> {
  if (!result.ok) {
    const isSelectorGone =
      result.kind === "selector" && watch.lastHash !== null && watch.lastValue !== null;
    const failStreak = watch.failStreak + 1;
    await db.$transaction([
      db.watch.update({
        where: { id: watch.id },
        data: {
          lastCheckedAt: new Date(),
          lastError: result.error,
          failStreak,
          ...extra,
          ...(isSelectorGone ? { isActive: false } : {}),
        },
      }),
      db.check.create({
        data: { watchId: watch.id, status: "error", error: result.error, durationMs },
      }),
    ]);
    if (isSelectorGone) {
      try {
        await sendSelectorGoneNotification({
          to: watch.notifyEmail,
          label: watch.label,
          url: watch.url,
          selector: watch.selector,
          lastValue: watch.lastValue!,
          watchId: watch.id,
        });
      } catch (e) {
        console.error("[check-watch] selector-gone email failed", e);
      }
      await pushTo(watch.userId, {
        title: `Page changed: ${watch.label}`,
        message: "The tracked element is no longer on the page. The watch is paused.",
        click: watch.url,
        priority: 3,
        tags: ["warning"],
      });
    } else if (failStreak === FAIL_SLOWDOWN_THRESHOLD) {
      try {
        await sendFailingNotification({
          to: watch.notifyEmail,
          label: watch.label,
          url: watch.url,
          lastError: result.error,
          failures: failStreak,
          slowedToMinutes: effectiveIntervalMinutes(watch.intervalMinutes, failStreak),
          watchId: watch.id,
        });
      } catch (e) {
        console.error("[check-watch] failing email failed", e);
      }
      await pushTo(watch.userId, {
        title: `Watch is failing: ${watch.label}`,
        message: `${failStreak}× in a row, now checked every ${effectiveIntervalMinutes(watch.intervalMinutes, failStreak)} min. Last error: ${result.error}`,
        click: watch.url,
        priority: 2,
        tags: ["warning"],
      });
    }
    return "error";
  }
  if (watch.lastHash === result.hash) {
    await db.$transaction([
      db.watch.update({
        where: { id: watch.id },
        data: {
          lastCheckedAt: new Date(),
          lastError: null,
          failStreak: 0,
          ...extra,
          imageUrl: result.imageUrl === watch.imageUrl ? undefined : result.imageUrl,
          faviconUrl: result.faviconUrl === watch.faviconUrl ? undefined : result.faviconUrl,
        },
      }),
      db.check.create({
        data: { watchId: watch.id, status: "same", value: result.value, durationMs },
      }),
    ]);
    return "same";
  }
  if (watch.lastHash !== null && watch.lastValue !== null) {
    await db.change.create({
      data: {
        watchId: watch.id,
        oldValue: watch.lastValue,
        newValue: result.value,
      },
    });
    const cond: Condition = {
      type: watch.conditionType as ConditionType,
      value: watch.conditionValue,
    };
    const historyMin = cond.type === "lowest" ? await historyMinimum(watch.id, watch.lastValue) : null;
    const shouldEmail = evaluateTransition(watch.lastValue, result.value, cond, historyMin);
    if (shouldEmail) {
      try {
        await sendChangeNotification({
          to: watch.notifyEmail,
          label: watch.label,
          url: watch.url,
          oldValue: watch.lastValue,
          newValue: result.value,
          watchId: watch.id,
        });
      } catch (e) {
        console.error("[check-watch] email send failed", e);
      }
      const tone = watch.selector === "@availability" ? availabilityTone(result.value) : null;
      await pushTo(watch.userId, {
        title: watch.label,
        message: `${watch.lastValue} → ${result.value}`,
        click: watch.url,
        priority: tone === "good" ? 4 : 3,
        tags: [tone === "good" ? "white_check_mark" : tone === "bad" ? "x" : "bell"],
      });
    }
  }
  await db.$transaction([
    db.watch.update({
      where: { id: watch.id },
      data: {
        lastCheckedAt: new Date(),
        lastValue: result.value,
        lastHash: result.hash,
        lastError: null,
        failStreak: 0,
        ...extra,
        imageUrl: result.imageUrl,
        faviconUrl: result.faviconUrl,
      },
    }),
    db.check.create({
      data: { watchId: watch.id, status: "changed", value: result.value, durationMs },
    }),
  ]);
  return "changed";
}

// The lowest number this watch has ever seen, across every recorded change.
async function historyMinimum(watchId: string, lastValue: string | null): Promise<number | null> {
  const changes = await db.change.findMany({
    where: { watchId },
    select: { oldValue: true, newValue: true },
  });
  const values = [...changes.flatMap((c) => [c.oldValue, c.newValue]), lastValue]
    .map(parseNumber)
    .filter((n): n is number => n !== null);
  return values.length ? Math.min(...values) : null;
}
