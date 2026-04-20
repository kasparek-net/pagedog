import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { intervalLabel, shortenUrl } from "@/lib/format";
import WatchControls from "./controls";

export const dynamic = "force-dynamic";

export default async function WatchDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) notFound();
  const { id } = await params;
  const watch = await db.watch.findFirst({ where: { id, userId } });
  if (!watch) notFound();
  const changes = await db.change.findMany({
    where: { watchId: id },
    orderBy: { detectedAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← zpět
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
        <Box title="Aktuální hodnota">
          {watch.lastError ? (
            <span className="text-red-600 text-sm">{watch.lastError}</span>
          ) : (
            <span className="font-mono text-sm break-all">
              {watch.lastValue ?? "—"}
            </span>
          )}
        </Box>
        <Box title="Notifikace na">
          <span className="text-sm">{watch.notifyEmail}</span>
        </Box>
        <Box title="Stav">
          <span className="text-sm">
            {watch.isActive ? "aktivní" : "pauznuto"}
            {" · interval "}
            {intervalLabel(watch.intervalMinutes)}
            {" · poslední check "}
            {watch.lastCheckedAt
              ? new Date(watch.lastCheckedAt).toLocaleString("cs-CZ")
              : "nikdy"}
          </span>
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
          Historie změn
        </h2>
        {changes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center text-sm text-neutral-500">
            Zatím žádná změna nebyla zaznamenána.
          </div>
        ) : (
          <ul className="space-y-2">
            {changes.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 text-sm"
              >
                <div className="text-xs text-neutral-500">
                  {new Date(c.detectedAt).toLocaleString("cs-CZ")}
                </div>
                <div className="mt-1 grid grid-cols-[60px_1fr] gap-x-3 gap-y-1">
                  <span className="text-xs text-neutral-500">Bylo:</span>
                  <span className="font-mono text-xs break-all line-through opacity-70">
                    {c.oldValue}
                  </span>
                  <span className="text-xs text-neutral-500">Nyní:</span>
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
