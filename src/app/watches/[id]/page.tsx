import Link from "next/link";
import { AvailabilityPill } from "@/components/availability-pill";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionEmail } from "@/lib/session";
import { intervalLabel, shortenUrl } from "@/lib/format";
import { conditionLabel, type ConditionType } from "@/lib/condition";
import { Countdown } from "@/components/countdown";
import { ValueChart } from "@/components/value-chart";
import { AvailabilityTimeline } from "@/components/availability-timeline";
import { formatDeltaPct, seriesFromChanges, summarizeSeries } from "@/lib/numeric";
import { nowMs } from "@/lib/format";
import WatchControls from "./controls";

export const dynamic = "force-dynamic";

export default async function WatchDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const email = await getSessionEmail();
  if (!email) notFound();
  const { id } = await params;
  const watch = await db.watch.findFirst({ where: { id, userId: email } });
  if (!watch) notFound();
  const [changes, checks] = await Promise.all([
    db.change.findMany({
      where: { watchId: id },
      orderBy: { detectedAt: "desc" },
      take: 50,
    }),
    db.check.findMany({
      where: { watchId: id },
      orderBy: { checkedAt: "desc" },
      take: 30,
    }),
  ]);

  const dueMs = watch.lastCheckedAt
    ? watch.lastCheckedAt.getTime() + watch.intervalMinutes * 60_000
    : nowMs();
  const cronTickMs = Math.ceil(nowMs() / (15 * 60_000)) * (15 * 60_000);
  const nextMs = Math.max(dueMs, cronTickMs);
  const numeric = summarizeSeries(seriesFromChanges(changes, watch.lastValue));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← back
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {watch.label}
        </h1>
        <a
          href={watch.url}
          target="_blank"
          rel="noreferrer"
          title={watch.url}
          className="inline-block max-w-full text-sm text-neutral-500 hover:underline truncate"
        >
          {shortenUrl(watch.url, 70)} ↗
        </a>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Box title={watch.selector.startsWith("@") ? "Tracked field" : "CSS selector"}>
          {watch.selector === "@availability" ? (
            <span className="text-sm">Product availability</span>
          ) : watch.selector === "@price" ? (
            <span className="text-sm">Product price</span>
          ) : (
            <code className="font-mono text-xs break-all">{watch.selector}</code>
          )}
        </Box>
        <Box title="Current value">
          {watch.lastError ? (
            <span className="text-red-600 text-sm">{watch.lastError}</span>
          ) : watch.lastValue && watch.selector === "@availability" ? (
            <AvailabilityPill value={watch.lastValue} size="md" />
          ) : (
            <span className="font-mono text-sm break-all">
              {watch.lastValue ?? "—"}
            </span>
          )}
        </Box>
        <Box title="Notify">
          <div className="text-sm">{watch.notifyEmail}</div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {conditionLabel(watch.conditionType as ConditionType, watch.conditionValue)}
          </div>
        </Box>
        <Box title="Status">
          <div className="text-sm">
            {watch.isActive ? "active" : "paused"} · every{" "}
            {intervalLabel(watch.intervalMinutes)}
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">
            last check{" "}
            {watch.lastCheckedAt
              ? new Date(watch.lastCheckedAt).toLocaleString("en-US")
              : "never"}
            {watch.isActive && (
              <>
                {" · next scan "}
                <Countdown targetMs={nextMs} prefix="in" overdue="any second" />
              </>
            )}
          </div>
        </Box>
      </div>

      {numeric && numeric.values.length >= 2 && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 pt-3 pb-2">
          <div className="flex items-baseline justify-between gap-4">
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Value history
            </div>
            <div className="text-xs text-neutral-500 truncate">
              low {numeric.lowest} · high {numeric.highest}
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2.5 flex-wrap">
            <span className="text-2xl font-semibold tabular-nums">{numeric.current}</span>
            {numeric.deltaPct !== null && (
              <span
                className={`text-sm ${
                  numeric.deltaPct < 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
                title={`since ${numeric.previous}`}
              >
                {numeric.deltaPct < 0 ? "↓" : "↑"} {formatDeltaPct(numeric.deltaPct)}
              </span>
            )}
            {numeric.isLowest && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                lowest
              </span>
            )}
          </div>
          <div className="mt-3">
            <ValueChart values={numeric.values} />
          </div>
          <div className="flex justify-between gap-3 text-xs text-neutral-500">
            <span className="truncate">{numeric.oldest}</span>
            <span className="shrink-0">{numeric.values.length} values</span>
            <span className="truncate">{numeric.current}</span>
          </div>
        </div>
      )}

      {!numeric && changes.length > 0 && (
        <AvailabilityTimeline
          changes={changes}
          current={watch.lastValue}
          since={watch.createdAt}
          now={nowMs()}
          colored={watch.selector === "@availability"}
        />
      )}

      <WatchControls
        id={watch.id}
        isActive={watch.isActive}
        label={watch.label}
        notifyEmail={watch.notifyEmail}
        intervalMinutes={watch.intervalMinutes}
        conditionType={watch.conditionType}
        conditionValue={watch.conditionValue}
      />

      <div>
        <h2 className="text-sm font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide mb-2">
          Preview
        </h2>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white shadow-sm">
          <iframe
            src={`/api/preview?url=${encodeURIComponent(watch.url)}&mode=view&selector=${encodeURIComponent(watch.selector)}`}
            sandbox="allow-scripts"
            loading="lazy"
            className="w-full bg-white"
            style={{ height: "500px" }}
            title="Watched page preview"
          />
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          Highlighted yellow box is the element being tracked. Cached page from a fresh fetch.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide mb-2">
          Change history
        </h2>
        {changes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center text-sm text-neutral-500">
            No changes recorded yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {changes.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 text-sm"
              >
                <div className="text-xs text-neutral-500">
                  {new Date(c.detectedAt).toLocaleString("en-US")}
                </div>
                <div className="mt-1 grid grid-cols-[60px_1fr] gap-x-3 gap-y-1">
                  <span className="text-xs text-neutral-500">Was:</span>
                  <span className="font-mono text-xs break-all line-through opacity-70">
                    {c.oldValue}
                  </span>
                  <span className="text-xs text-neutral-500">Now:</span>
                  <span className="font-mono text-xs break-all">{c.newValue}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide mb-2">
          Activity log
        </h2>
        {checks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center text-sm text-neutral-500">
            No checks recorded yet.
          </div>
        ) : (
          <ul className="rounded-xl border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
            {checks.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <StatusDot status={c.status} />
                <span className="text-xs text-neutral-500 tabular-nums shrink-0 w-40">
                  {new Date(c.checkedAt).toLocaleString("en-US")}
                </span>
                <span className="font-mono text-xs truncate flex-1 text-neutral-700 dark:text-neutral-300">
                  {c.status === "error" ? (
                    <span className="text-red-600">{c.error}</span>
                  ) : (
                    c.value
                  )}
                </span>
                {c.durationMs !== null && (
                  <span className="text-xs text-neutral-400 tabular-nums shrink-0">
                    {c.durationMs} ms
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    same: { color: "bg-neutral-400", label: "no change" },
    changed: { color: "bg-brand", label: "changed" },
    error: { color: "bg-red-500", label: "error" },
  };
  const s = map[status] ?? map.same;
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${s.color}`}
      title={s.label}
    />
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">
        {title}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
