"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { INTERVAL_OPTIONS } from "@/lib/format";

type TestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; value: string }
  | { status: "error"; error: string };

export default function NewWatchForm({ defaultEmail }: { defaultEmail: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [selector, setSelector] = useState("");
  const [pickedText, setPickedText] = useState("");
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data as { type?: string; selector?: string; text?: string };
      if (!data || typeof data !== "object") return;
      if (data.type === "wd:pick" && data.selector) {
        setSelector(data.selector);
        setPickedText(data.text ?? "");
        setTest({ status: "ok", value: data.text ?? "" });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!selector || !url || !previewHtml) return;
    if (test.status === "ok" && test.value === pickedText && pickedText) return;
    const handle = setTimeout(async () => {
      setTest({ status: "loading" });
      try {
        const res = await fetch(
          `/api/preview?url=${encodeURIComponent(url)}&mode=test&selector=${encodeURIComponent(selector)}`,
        );
        const j = await res.json();
        if (j.ok) setTest({ status: "ok", value: j.value });
        else setTest({ status: "error", error: j.error ?? "Selector nesedí" });
      } catch (err) {
        setTest({ status: "error", error: err instanceof Error ? err.message : "Chyba" });
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [selector, url, previewHtml, pickedText, test]);

  async function loadPreview(e: React.FormEvent) {
    e.preventDefault();
    setLoadingPreview(true);
    setPreviewError(null);
    setPreviewHtml(null);
    setSelector("");
    setPickedText("");
    setTest({ status: "idle" });
    try {
      const res = await fetch(`/api/preview?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Načtení selhalo" }));
        setPreviewError(j.error ?? `HTTP ${res.status}`);
        return;
      }
      const html = await res.text();
      setPreviewHtml(html);
      try {
        const u = new URL(url);
        if (!label) setLabel(u.hostname);
      } catch {}
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, url, selector, notifyEmail: email, intervalMinutes }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Uložení selhalo" }));
        setSubmitError(typeof j.error === "string" ? j.error : "Uložení selhalo");
        return;
      }
      const j = await res.json();
      router.push(`/watches/${j.watch.id}`);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSubmitting(false);
    }
  }

  const canSave = !!selector && !!label && !!email && !submitting;

  return (
    <div className="space-y-4">
      <form onSubmit={loadPreview} className="flex gap-2">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://shop.cz/produkt"
          className="flex-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
        />
        <button
          type="submit"
          disabled={loadingPreview || !url}
          className="shrink-0 rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
        >
          {loadingPreview ? "Načítám…" : previewHtml ? "Načíst znovu" : "Načíst"}
        </button>
      </form>
      {previewError && (
        <div className="text-sm text-red-600">{previewError}</div>
      )}

      {previewHtml && (
        <>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white shadow-sm">
            <iframe
              ref={iframeRef}
              srcDoc={previewHtml}
              sandbox="allow-scripts"
              className="w-full bg-white"
              style={{ height: "calc(100vh - 380px)", minHeight: "600px" }}
              title="Náhled stránky"
            />
          </div>
          <p className="text-xs text-neutral-500">
            Pokud je náhled prázdný nebo chybí obsah, stránka se renderuje JavaScriptem a picker ji neumí otevřít — selector zadej ručně.
          </p>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 shrink-0">
                Selector
              </span>
              <input
                value={selector}
                onChange={(e) => setSelector(e.target.value)}
                placeholder="Klikni na element v náhledu nebo napiš selector"
                className="flex-1 font-mono text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
              />
              <TestBadge state={test} />
            </div>
            <div className="text-sm rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 min-h-[38px] font-mono text-xs">
              {test.status === "ok" ? (
                test.value
              ) : test.status === "error" ? (
                <span className="text-red-600">{test.error}</span>
              ) : test.status === "loading" ? (
                <span className="text-neutral-400">Testuji selector…</span>
              ) : pickedText ? (
                pickedText
              ) : (
                <span className="text-neutral-400">— čekám na selector —</span>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <Field label="Název">
              <input
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Naskladnění Foo"
                className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none"
              />
            </Field>
            <Field label="Notifikační email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none"
              />
            </Field>
            <Field label="Kontrolovat každých">
              <select
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none"
              >
                {INTERVAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-neutral-50/90 dark:bg-neutral-950/90 backdrop-blur border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <div className="text-xs text-neutral-500">
              {selector ? "Připraveno k uložení" : "Vyber element v náhledu"}
            </div>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="rounded-md bg-emerald-600 text-white px-5 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? "Ukládám…" : "Uložit hlídání"}
            </button>
          </div>
          {submitError && <div className="text-sm text-red-600">{submitError}</div>}
        </>
      )}
    </div>
  );
}

function TestBadge({ state }: { state: TestState }) {
  if (state.status === "loading")
    return (
      <span className="text-xs px-2 py-1 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 shrink-0">
        …
      </span>
    );
  if (state.status === "ok")
    return (
      <span className="text-xs px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 shrink-0">
        ✓ Match
      </span>
    );
  if (state.status === "error")
    return (
      <span className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 shrink-0">
        ✕
      </span>
    );
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
