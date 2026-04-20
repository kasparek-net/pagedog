import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { shortenUrl } from "@/lib/format";

export const dynamic = "force-dynamic";

function timeAgo(d: Date | null): string {
  if (!d) return "—";
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "právě teď";
  if (m < 60) return `před ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `před ${h} h`;
  const days = Math.floor(h / 24);
  return `před ${days} d`;
}

export default async function HomePage() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <div className="text-center py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Pagedog</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Hlídá změny na webových stránkách a posílá ti email.
        </p>
        <Link
          href="/sign-in"
          className="inline-block mt-6 rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-4 py-2 text-sm hover:opacity-90"
        >
          Začít →
        </Link>
      </div>
    );
  }

  const user = await currentUser();
  const watches = await db.watch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { changes: true } } },
  });

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Hlídání</h1>
        <span className="text-sm text-neutral-500">
          {user?.firstName ?? "Ahoj"}
        </span>
      </div>
      {watches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-10 text-center">
          <p className="text-neutral-600 dark:text-neutral-400">
            Zatím nemáš žádné hlídání.
          </p>
          <Link
            href="/watches/new"
            className="inline-block mt-4 rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-4 py-2 text-sm hover:opacity-90"
          >
            Vytvořit první →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {watches.map((w) => (
            <li
              key={w.id}
              className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition"
            >
              <Link
                href={`/watches/${w.id}`}
                className="block px-4 py-3 sm:flex sm:items-center sm:justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{w.label}</span>
                    {!w.isActive && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                        pauznuto
                      </span>
                    )}
                    {w.lastError && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400">
                        chyba
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500 truncate mt-0.5" title={w.url}>
                    {shortenUrl(w.url, 60)}
                  </div>
                </div>
                <div className="mt-2 sm:mt-0 sm:text-right text-xs text-neutral-500 shrink-0">
                  <div>
                    {w._count.changes} změn · poslední check {timeAgo(w.lastCheckedAt)}
                  </div>
                  {w.lastValue && (
                    <div className="font-mono text-neutral-700 dark:text-neutral-300 truncate max-w-xs">
                      {w.lastValue}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
