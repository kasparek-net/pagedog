import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionEmail } from "@/lib/session";
import { intervalLabel, shortenUrl } from "@/lib/format";
import { Countdown } from "@/components/countdown";
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
  const changes = await db.change.findMany({
    where: { watchId: id },
    orderBy: { detectedAt: "desc" },
    take: 50,
  });

  const dueMs = watch.lastCheckedAt
    ? watch.lastCheckedAt.getTime() + watch.intervalMinutes * 60_000
    : Date.now();
  const cronTickMs = Math.ceil(Date.now() / (15 * 60_000)) * (15 * 60_000);
  const nextMs = Math.max(dueMs, cronTickMs);

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
        <Box title="CSS selector">
          <code className="font-mono text-xs break-all">{watch.selector}</code>
        </Box>
        <Box title="Current value">
          {watch.lastError ? (
            <span className="text-red-600 text-sm">{watch.lastError}</span>
          ) : (
            <span className="font-mono text-sm break-all">
              {watch.lastValue ?? "—"}
            </span>
          )}
        </Box>
        <Box title="Notify">
          <span className="text-sm">{watch.notifyEmail}</span>
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

      <WatchControls
        id={watch.id}
        isActive={watch.isActive}
        label={watch.label}
        notifyEmail={watch.notifyEmail}
        intervalMinutes={watch.intervalMinutes}
      />

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
    </div>
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
