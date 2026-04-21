"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/field";
import { IntervalGroup } from "@/components/interval-group";
import { ConditionPicker } from "@/components/condition-picker";
import { isValidRegex, optionFor, type ConditionType } from "@/lib/condition";

export default function WatchControls({
  id,
  isActive,
  label: initialLabel,
  notifyEmail: initialEmail,
  intervalMinutes: initialInterval,
  conditionType: initialConditionType,
  conditionValue: initialConditionValue,
}: {
  id: string;
  isActive: boolean;
  label: string;
  notifyEmail: string;
  intervalMinutes: number;
  conditionType: string;
  conditionValue: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState(initialLabel);
  const [email, setEmail] = useState(initialEmail);
  const [interval, setIntervalValue] = useState(initialInterval);
  const [conditionType, setConditionType] = useState<ConditionType>(initialConditionType as ConditionType);
  const [conditionValue, setConditionValue] = useState(initialConditionValue ?? "");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

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

  const labelTrim = label.trim();
  const emailTrim = email.trim();
  const condValueTrim = conditionValue.trim();
  const condOpt = optionFor(conditionType);

  const dirty =
    labelTrim !== initialLabel.trim() ||
    emailTrim !== (initialEmail ?? "").trim() ||
    interval !== initialInterval ||
    conditionType !== (initialConditionType as ConditionType) ||
    (condOpt.needsValue ? condValueTrim : "") !== (initialConditionValue ?? "").trim();

  const valid =
    labelTrim.length > 0 &&
    /.+@.+\..+/.test(emailTrim) &&
    (!condOpt.needsValue ||
      (condValueTrim.length > 0 &&
        (conditionType !== "regex" || isValidRegex(condValueTrim)) &&
        (condOpt.valueKind !== "number" || Number.isFinite(Number(condValueTrim)))));

  async function save() {
    if (!dirty || !valid) return;
    setSaveMsg(null);
    await patch({
      label: labelTrim,
      notifyEmail: emailTrim,
      intervalMinutes: interval,
      conditionType,
      conditionValue: condOpt.needsValue ? condValueTrim : null,
    });
    setSaveMsg("saved");
  }

  async function remove() {
    if (!confirm("Delete this watch?")) return;
    setBusy(true);
    try {
      await fetch(`/api/watches/${id}`, { method: "DELETE" });
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);

  async function checkNow() {
    setChecking(true);
    setCheckMsg(null);
    try {
      const res = await fetch(`/api/watches/${id}/check`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setCheckMsg(data?.error ?? "Check failed");
        return;
      }
      const label =
        data?.status === "changed"
          ? "change detected"
          : data?.status === "error"
            ? "check failed"
            : "no change";
      setCheckMsg(label);
      router.refresh();
    } catch {
      setCheckMsg("Check failed");
    } finally {
      setChecking(false);
    }
  }

  function markDirty() {
    if (saveMsg) setSaveMsg(null);
  }

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Label">
          <input
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              markDirty();
            }}
            placeholder="Label"
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
        </Field>
        <Field label="Notify email">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              markDirty();
            }}
            placeholder="Email"
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
        </Field>
      </div>
      <Field label="Check every">
        <IntervalGroup
          value={interval}
          disabled={busy}
          onChange={(v) => {
            setIntervalValue(v);
            markDirty();
          }}
        />
      </Field>
      <ConditionPicker
        type={conditionType}
        value={conditionValue}
        onTypeChange={(t) => {
          setConditionType(t);
          if (!optionFor(t).needsValue) setConditionValue("");
          markDirty();
        }}
        onValueChange={(v) => {
          setConditionValue(v);
          markDirty();
        }}
      />
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
        <button
          disabled={busy || !dirty || !valid}
          onClick={save}
          className="rounded-md bg-brand text-black px-3 py-1.5 text-sm font-medium hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {saveMsg && !dirty && (
          <span className="text-xs text-neutral-500">{saveMsg}</span>
        )}
        <button
          disabled={checking}
          onClick={checkNow}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
        >
          {checking ? "Checking…" : "Check now"}
        </button>
        {checkMsg && (
          <span className="text-xs text-neutral-500">{checkMsg}</span>
        )}
        <div className="grow" />
        <button
          disabled={busy}
          onClick={() => patch({ isActive: !isActive })}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
        >
          {isActive ? "Pause" : "Resume"}
        </button>
        <button
          disabled={busy}
          onClick={remove}
          className="rounded-md border border-red-300 dark:border-red-900 text-red-600 px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
