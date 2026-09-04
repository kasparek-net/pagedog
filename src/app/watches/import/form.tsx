"use client";

import { useState } from "react";
import Link from "next/link";
import { Field } from "@/components/field";
import { IntervalGroup } from "@/components/interval-group";

type Row = {
  url: string;
  status: "pending" | "working" | "ok" | "error";
  detail?: string;
  id?: string;
};

export default function ImportForm() {
  const [text, setText] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);

  const urls = Array.from(
    new Set(
      text
        .split(/\s+/)
        .map((s) => s.trim())
        .filter((s) => /^https?:\/\//i.test(s)),
    ),
  );

  async function run() {
    setRunning(true);
    const initial: Row[] = urls.map((url) => ({ url, status: "pending" }));
    setRows(initial);
    // One at a time: a blocked shop goes through the local agent and that
    // takes seconds per page, so progress is worth more than parallelism.
    for (let i = 0; i < initial.length; i++) {
      setRows((r) => r.map((row, j) => (j === i ? { ...row, status: "working" } : row)));
      try {
        const res = await fetch("/api/watches/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: initial[i].url, intervalMinutes }),
        });
        const data = await res.json().catch(() => null);
        setRows((r) =>
          r.map((row, j) =>
            j === i
              ? res.ok
                ? { ...row, status: "ok", id: data?.id, detail: `${data?.label} · ${data?.value ?? "no value yet"}` }
                : { ...row, status: "error", id: data?.id, detail: data?.error ?? `HTTP ${res.status}` }
              : row,
          ),
        );
      } catch {
        setRows((r) => r.map((row, j) => (j === i ? { ...row, status: "error", detail: "Request failed" } : row)));
      }
    }
    setRunning(false);
  }

  const done = rows.length > 0 && !running;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-4">
        <Field label="Links">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            spellCheck={false}
            placeholder={"https://www.alza.cz/...\nhttps://www.lidl.cz/..."}
            className="w-full font-mono text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand"
          />
        </Field>
        <Field label="Check every">
          <IntervalGroup value={intervalMinutes} onChange={setIntervalMinutes} disabled={running} />
        </Field>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={urls.length === 0 || running}
            onClick={run}
            className="rounded-md bg-brand text-black px-5 py-2.5 text-sm font-semibold hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {running ? "Importing…" : `Import ${urls.length || ""}`.trim()}
          </button>
          {done && (
            <Link href="/" className="text-sm underline">
              Back to watches
            </Link>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <ul className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-800">
          {rows.map((row) => (
            <li key={row.url} className="px-4 py-3 text-sm flex items-start gap-3">
              <span className="w-5 shrink-0 text-center" aria-label={row.status}>
                {row.status === "ok" ? "✓" : row.status === "error" ? "✕" : row.status === "working" ? "…" : "·"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-xs text-neutral-500">{row.url}</div>
                {row.detail && (
                  <div className={row.status === "error" ? "text-red-600" : ""}>
                    {row.id ? <Link href={`/watches/${row.id}`} className="hover:underline">{row.detail}</Link> : row.detail}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
