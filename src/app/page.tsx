import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionEmail } from "@/lib/session";
import { WatchRow } from "@/components/watch-row";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const email = await getSessionEmail();
  if (!email) {
    return (
      <div className="text-center py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Pagedog</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Watches web pages for changes and emails you when they happen.
        </p>
        <Link
          href="/sign-in"
          className="inline-block mt-6 rounded-md bg-brand text-black px-4 py-2 text-sm font-medium hover:bg-brand-dark"
        >
          Get started →
        </Link>
      </div>
    );
  }

  const watches = await db.watch.findMany({
    where: { userId: email },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { changes: true } } },
  });

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Watches</h1>
        <span className="text-sm text-neutral-500 truncate max-w-[200px]">{email}</span>
      </div>
      {watches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-10 text-center">
          <p className="text-neutral-600 dark:text-neutral-400">
            No watches yet.
          </p>
          <Link
            href="/watches/new"
            className="inline-block mt-4 rounded-md bg-brand text-black px-4 py-2 text-sm font-medium hover:bg-brand-dark"
          >
            Create your first →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {watches.map((w) => (
            <WatchRow
              key={w.id}
              watch={{
                id: w.id,
                label: w.label,
                url: w.url,
                isActive: w.isActive,
                intervalMinutes: w.intervalMinutes,
                lastValue: w.lastValue,
                lastError: w.lastError,
                lastCheckedAt: w.lastCheckedAt ? w.lastCheckedAt.toISOString() : null,
                imageUrl: w.imageUrl,
                faviconUrl: w.faviconUrl,
                changeCount: w._count.changes,
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
