"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Countdown } from "./countdown";
import { shortenUrl } from "@/lib/format";

type Watch = {
  id: string;
  label: string;
  url: string;
  isActive: boolean;
  intervalMinutes: number;
  lastValue: string | null;
  lastError: string | null;
  lastCheckedAt: string | null;
  changeCount: number;
};

export function WatchRow({ watch }: { watch: Watch }) {
  const router = useRouter();
  const [active, setActive] = useState(watch.isActive);
  const [pending, startTransition] = useTransition();

  const lastMs = watch.lastCheckedAt ? new Date(watch.lastCheckedAt).getTime() : null;
  const dueMs = lastMs !== null ? lastMs + watch.intervalMinutes * 60_000 : Date.now();
  const cronTickMs = Math.ceil(Date.now() / (15 * 60_000)) * (15 * 60_000);
  const nextMs = Math.max(dueMs, cronTickMs);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !active;
    setActive(next);
    startTransition(async () => {
      try {
        await fetch(`/api/watches/${watch.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: next }),
        });
        router.refresh();
      } catch {
        setActive(!next);
      }
    });
  }

  return (
    <li className="relative rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition">
      <Link href={`/watches/${watch.id}`} className="block px-4 py-3 pr-14">
        <div className="sm:flex sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{watch.label}</span>
              {!active && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                  paused
                </span>
              )}
              {watch.lastError && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400">
                  error
                </span>
              )}
            </div>
            <div className="text-xs text-neutral-500 truncate mt-0.5" title={watch.url}>
              {shortenUrl(watch.url, 60)}
            </div>
          </div>
          <div className="mt-2 sm:mt-0 sm:text-right text-xs text-neutral-500 shrink-0">
            <div>
              {watch.changeCount} {watch.changeCount === 1 ? "change" : "changes"}
              {active && (
                <>
                  {" · next scan "}
                  <Countdown targetMs={nextMs} prefix="in" overdue="any second" />
                </>
              )}
            </div>
            {watch.lastValue && (
              <div className="font-mono text-neutral-700 dark:text-neutral-300 truncate max-w-xs">
                {watch.lastValue}
              </div>
            )}
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        title={active ? "Pause" : "Resume"}
        aria-label={active ? "Pause watch" : "Resume watch"}
        className="absolute right-3 top-3 inline-flex items-center justify-center w-8 h-8 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 text-neutral-600 dark:text-neutral-300"
      >
        {active ? <PauseIcon /> : <PlayIcon />}
      </button>
    </li>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="9" y1="6" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="18" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <polygon points="7,5 19,12 7,19" />
    </svg>
  );
}
