import { db } from "@/lib/db";
import { fetchAndExtract } from "@/lib/extract";
import { sendChangeNotification, sendAutoPauseNotification } from "@/lib/email";
import { evaluate, type Condition, type ConditionType } from "@/lib/condition";

const AUTO_PAUSE_THRESHOLD = 5;

export type ProcessInput = {
  id: string;
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
};

export type ProcessResult = "changed" | "same" | "error";

export async function processWatch(watch: ProcessInput): Promise<ProcessResult> {
  const t0 = Date.now();
  const result = await fetchAndExtract(watch.url, watch.selector);
  const durationMs = Date.now() - t0;

  if (!result.ok) {
    await db.$transaction([
      db.watch.update({
        where: { id: watch.id },
        data: { lastCheckedAt: new Date(), lastError: result.error },
      }),
      db.check.create({
        data: { watchId: watch.id, status: "error", error: result.error, durationMs },
      }),
    ]);
    await maybeAutoPause(watch);
    return "error";
  }
  if (watch.lastHash === result.hash) {
    await db.$transaction([
      db.watch.update({
        where: { id: watch.id },
        data: {
          lastCheckedAt: new Date(),
          lastError: null,
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
    const shouldEmail =
      cond.type === "change"
        ? true
        : !evaluate(watch.lastValue, cond) && evaluate(result.value, cond);
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

async function maybeAutoPause(watch: ProcessInput) {
  const recent = await db.check.findMany({
    where: { watchId: watch.id },
    orderBy: { checkedAt: "desc" },
    take: AUTO_PAUSE_THRESHOLD,
    select: { status: true, error: true },
  });
  if (recent.length < AUTO_PAUSE_THRESHOLD) return;
  if (!recent.every((c) => c.status === "error")) return;
  await db.watch.update({
    where: { id: watch.id },
    data: { isActive: false },
  });
  try {
    await sendAutoPauseNotification({
      to: watch.notifyEmail,
      label: watch.label,
      url: watch.url,
      lastError: recent[0]?.error ?? "unknown error",
      failures: AUTO_PAUSE_THRESHOLD,
      watchId: watch.id,
    });
  } catch (e) {
    console.error("[check-watch] auto-pause email failed", e);
  }
}
