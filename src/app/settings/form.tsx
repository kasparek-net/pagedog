"use client";

import { useState } from "react";
import { Field } from "@/components/field";

export default function SettingsForm({ ntfyTopic: initialTopic }: { ntfyTopic: string }) {
  const [topic, setTopic] = useState(initialTopic);
  const [saved, setSaved] = useState(initialTopic);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const dirty = topic.trim() !== saved;

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ntfyTopic: topic }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg(data?.error ?? "Saving failed");
        return;
      }
      setSaved(data?.ntfyTopic ?? "");
      setTopic(data?.ntfyTopic ?? "");
      setMsg(data?.ntfyTopic ? "saved" : "push notifications off");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/settings/test-push", { method: "POST" });
      const data = await res.json().catch(() => null);
      setTestMsg(res.ok ? "sent — check your phone" : (data?.error ?? "sending failed"));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-5">
      <div>
        <h2 className="font-medium mb-1">Push notifications</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Email is fine for a price drop; for a restock you want your phone to buzz. Install the{" "}
          <a href="https://ntfy.sh/" target="_blank" rel="noreferrer" className="underline">
            ntfy
          </a>{" "}
          app, subscribe to a topic name of your own choosing (treat it like a password — anyone
          who knows it can read and send), and enter the same name here. Leave it empty to turn
          push off.
        </p>
      </div>
      <Field label="ntfy topic">
        <input
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            setMsg(null);
          }}
          placeholder="e.g. pagedog-k7x2m9"
          spellCheck={false}
          className="w-full font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={save}
          className="rounded-md bg-brand text-black px-4 py-2 text-sm font-semibold hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {msg && <span className="text-xs text-neutral-500">{msg}</span>}
        <button
          type="button"
          disabled={testing || dirty || !saved}
          onClick={sendTest}
          title={dirty ? "Save first" : "Send a test push to this topic"}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
        >
          {testing ? "Sending…" : "Send test push"}
        </button>
        {testMsg && <span className="text-xs text-neutral-500">{testMsg}</span>}
      </div>
    </div>
  );
}
