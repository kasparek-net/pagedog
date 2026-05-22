"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/field";
import { IntervalGroup } from "@/components/interval-group";
import { ConditionPicker } from "@/components/condition-picker";
import { isValidRegex, optionFor, type ConditionType } from "@/lib/condition";

type TestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; value: string }
  | { status: "error"; error: string };

export default function NewWatchForm({ defaultEmail }: { defaultEmail: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loadedUrl, setLoadedUrl] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [selector, setSelector] = useState("");
  const [pickedText, setPickedText] = useState("");
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [conditionType, setConditionType] = useState<ConditionType>("change");
  const [conditionValue, setConditionValue] = useState("");
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
    if (!selector || !loadedUrl || !previewHtml) return;
    if (test.status === "ok" && test.value === pickedText && pickedText) return;
    const handle = setTimeout(async () => {
      setTest({ status: "loading" });
      try {
        const res = await fetch(
          `/api/preview?url=${encodeURIComponent(loadedUrl)}&mode=test&selector=${encodeURIComponent(selector)}`,
        );
        const j = await res.json();
        if (j.ok) setTest({ status: "ok", value: j.value });
        else setTest({ status: "error", error: j.error ?? "Selector did not match" });
      } catch (err) {
        setTest({ status: "error", error: err instanceof Error ? err.message : "Error" });
      }
    }, 500);
    return () => clearTimeout(handle);
    // `test` intentionally excluded — it's mutated inside; including would loop on error transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selector, loadedUrl, previewHtml, pickedText]);

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
        const j = await res.json().catch(() => ({ error: "Failed to load" }));
        setPreviewError(j.error ?? `HTTP ${res.status}`);
        return;
      }
      const html = await res.text();
      setPreviewHtml(html);
      setLoadedUrl(url);
      try {
        const u = new URL(url);
        if (!label) setLabel(u.hostname.replace(/^www\./, ""));
      } catch {}
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Error");
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
        body: JSON.stringify({
          label,
          url: loadedUrl,
          selector,
          notifyEmail: email,
          intervalMinutes,
          conditionType,
          conditionValue: optionFor(conditionType).needsValue ? conditionValue.trim() : null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Failed to save" }));
        setSubmitError(typeof j.error === "string" ? j.error : "Failed to save");
        return;
      }
      const j = await res.json();
      router.push(`/watches/${j.watch.id}`);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  const conditionOpt = optionFor(conditionType);
  const conditionValid =
    !conditionOpt.needsValue ||
    (conditionValue.trim().length > 0 &&
      (conditionType !== "regex" || isValidRegex(conditionValue.trim())) &&
      (conditionOpt.valueKind !== "number" || Number.isFinite(Number(conditionValue))));
  const canSave = !!selector && !!label && !!email && conditionValid && !submitting;

  return (
    <div className="space-y-8 pb-24">
      <Section step={1} title="Page" hint="Enter a URL and we'll fetch a snapshot for you to pick from.">
        <form onSubmit={loadPreview} className="flex gap-2">
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://shop.com/product"
            className="flex-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            type="submit"
            disabled={loadingPreview || !url}
            className="shrink-0 rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loadingPreview ? "Loading…" : previewHtml ? "Reload" : "Load"}
          </button>
        </form>
        {previewError && <div className="text-sm text-red-600 mt-2">{previewError}</div>}
      </Section>

      {previewHtml && (
        <>
          <Section
            step={2}
            title="Element"
            hint="Hover the page below, click what you want to track, then press ✓ Use in the picker."
          >
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white shadow-sm">
              <iframe
                ref={iframeRef}
                srcDoc={previewHtml}
                sandbox="allow-scripts"
                className="w-full bg-white"
                style={{ height: "calc(100vh - 380px)", minHeight: "600px" }}
                title="Page preview"
              />
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Empty preview? The page is rendered by JavaScript — type the selector by hand.
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={selector}
                  onChange={(e) => setSelector(e.target.value)}
                  placeholder="CSS selector — clicks above fill this in"
                  className="flex-1 font-mono text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand"
                />
                <TestBadge state={test} />
              </div>
              <div className="text-sm rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-3 py-2.5 min-h-[42px] font-mono text-xs">
                {test.status === "ok" ? (
                  test.value
                ) : test.status === "error" ? (
                  <span className="text-red-600">{test.error}</span>
                ) : test.status === "loading" ? (
                  <span className="text-neutral-400">Testing selector…</span>
                ) : pickedText ? (
                  pickedText
                ) : (
                  <span className="text-neutral-400">— waiting for a selector —</span>
                )}
              </div>
            </div>
          </Section>

          <Section step={3} title="Settings" hint="Name it, choose where notifications go and how often we should check.">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Label">
                <input
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Product back in stock"
                  className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
                />
              </Field>
              <Field label="Notify email">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
                />
              </Field>
            </div>
            <Field label="Check every">
              <IntervalGroup value={intervalMinutes} onChange={setIntervalMinutes} />
            </Field>
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <ConditionPicker
                type={conditionType}
                value={conditionValue}
                onTypeChange={setConditionType}
                onValueChange={setConditionValue}
              />
            </div>
          </Section>

          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-neutral-50/95 dark:bg-neutral-950/95 backdrop-blur border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4">
            <div className="text-xs text-neutral-500 truncate">
              {selector ? (
                <>
                  Saving <code className="font-mono text-neutral-700 dark:text-neutral-300">{selector}</code>
                </>
              ) : (
                "Pick an element above to enable save"
              )}
            </div>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="shrink-0 rounded-md bg-brand text-black px-5 py-2.5 text-sm font-semibold hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving…" : "Save watch"}
            </button>
          </div>
          {submitError && <div className="text-sm text-red-600">{submitError}</div>}
        </>
      )}
    </div>
  );
}

function Section({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="flex items-baseline gap-3 mb-3">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold">
          {step}
        </span>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {hint && <p className="text-xs text-neutral-500 hidden sm:block">{hint}</p>}
      </header>
      {hint && <p className="text-xs text-neutral-500 mb-3 sm:hidden">{hint}</p>}
      {children}
    </section>
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
      <span className="text-xs px-2 py-1 rounded bg-brand text-black shrink-0 font-medium">
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

