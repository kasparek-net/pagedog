"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INTERVAL_OPTIONS } from "@/lib/format";

export default function WatchControls({
  id,
  isActive,
  label: initialLabel,
  notifyEmail: initialEmail,
  intervalMinutes: initialInterval,
}: {
  id: string;
  isActive: boolean;
  label: string;
  notifyEmail: string;
  intervalMinutes: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState(initialLabel);
  const [email, setEmail] = useState(initialEmail);
  const [interval, setIntervalValue] = useState(initialInterval);

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/watches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Opravdu smazat?")) return;
    setBusy(true);
    try {
      await fetch(`/api/watches/${id}`, { method: "DELETE" });
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label !== initialLabel && patch({ label })}
          placeholder="Název"
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => email !== initialEmail && patch({ notifyEmail: email })}
          placeholder="Email"
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none"
        />
        <select
          value={interval}
          onChange={(e) => {
            const v = Number(e.target.value);
            setIntervalValue(v);
            patch({ intervalMinutes: v });
          }}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none"
        >
          {INTERVAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Každých {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy}
          onClick={() => patch({ isActive: !isActive })}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
        >
          {isActive ? "Pauznout" : "Spustit"}
        </button>
        <button
          disabled={busy}
          onClick={remove}
          className="rounded-md border border-red-300 dark:border-red-900 text-red-600 px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
        >
          Smazat
        </button>
      </div>
    </div>
  );
}
