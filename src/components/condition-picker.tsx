"use client";

import { isValidRegex, optionFor, type ConditionType } from "@/lib/condition";
import { Field } from "./field";

type Category = "any" | "text" | "number";

const CATEGORIES: { value: Category; label: string; hint: string }[] = [
  { value: "any", label: "Anything changes", hint: "Fire on any diff" },
  { value: "text", label: "Text match", hint: "Compare the extracted text" },
  { value: "number", label: "Number", hint: "Compare the first number found" },
];

type Op = {
  value: ConditionType;
  label: string;
  placeholder: string;
  icon: () => React.ReactNode;
};

const TEXT_OPS: Op[] = [
  { value: "contains", label: "contains", placeholder: "In stock", icon: IconContains },
  { value: "not_contains", label: "doesn’t contain", placeholder: "Sold out", icon: IconNotContains },
  { value: "equals", label: "equals", placeholder: "Available", icon: IconEquals },
  { value: "regex", label: "matches regex", placeholder: "\\d+\\s?€", icon: IconRegex },
];

const NUMBER_OPS: Op[] = [
  { value: "number_lt", label: "less than", placeholder: "1000", icon: IconLessThan },
  { value: "number_gt", label: "greater than", placeholder: "0", icon: IconGreaterThan },
];

function categoryFor(type: ConditionType): Category {
  if (type === "change") return "any";
  if (type === "number_lt" || type === "number_gt") return "number";
  return "text";
}

export function ConditionPicker({
  type,
  value,
  onTypeChange,
  onValueChange,
}: {
  type: ConditionType;
  value: string;
  onTypeChange: (t: ConditionType) => void;
  onValueChange: (v: string) => void;
  layout?: "grid" | "stack";
}) {
  const category = categoryFor(type);
  const opt = optionFor(type);

  const regexError =
    type === "regex" && value.trim() && !isValidRegex(value.trim())
      ? "Invalid regex"
      : null;
  const numberError =
    opt.valueKind === "number" && value.trim() && !Number.isFinite(Number(value))
      ? "Must be a number"
      : null;
  const error = regexError ?? numberError;

  const activeOp = opt;
  const activePlaceholder =
    category === "text"
      ? TEXT_OPS.find((o) => o.value === type)?.placeholder ?? ""
      : category === "number"
        ? NUMBER_OPS.find((o) => o.value === type)?.placeholder ?? ""
        : "";

  function pickCategory(next: Category) {
    if (next === category) return;
    if (next === "any") onTypeChange("change");
    else if (next === "text") onTypeChange("contains");
    else onTypeChange("number_lt");
  }

  return (
    <Field label="Notify when">
      <div className="space-y-3">
        <Segmented>
          {CATEGORIES.map((c) => (
            <SegmentedButton
              key={c.value}
              active={category === c.value}
              onClick={() => pickCategory(c.value)}
              title={c.hint}
            >
              {c.label}
            </SegmentedButton>
          ))}
        </Segmented>

        {category === "text" && (
          <div className="flex flex-wrap items-center gap-2">
            <Segmented>
              {TEXT_OPS.map((o) => (
                <SegmentedButton
                  key={o.value}
                  active={type === o.value}
                  onClick={() => onTypeChange(o.value)}
                  icon={o.icon}
                >
                  {o.label}
                </SegmentedButton>
              ))}
            </Segmented>
            <input
              type="text"
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder={activePlaceholder}
              className={
                "min-w-0 flex-1 rounded-md border bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-brand " +
                (error
                  ? "border-red-400"
                  : "border-neutral-300 dark:border-neutral-700")
              }
            />
          </div>
        )}

        {category === "number" && (
          <div className="flex flex-wrap items-center gap-2">
            <Segmented>
              {NUMBER_OPS.map((o) => (
                <SegmentedButton
                  key={o.value}
                  active={type === o.value}
                  onClick={() => onTypeChange(o.value)}
                  icon={o.icon}
                >
                  {o.label}
                </SegmentedButton>
              ))}
            </Segmented>
            <input
              type="number"
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder={activePlaceholder}
              step="any"
              className={
                "w-32 rounded-md border bg-white dark:bg-neutral-900 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-brand " +
                (error
                  ? "border-red-400"
                  : "border-neutral-300 dark:border-neutral-700")
              }
            />
          </div>
        )}

        {activeOp.needsValue && error && (
          <div className="text-xs text-red-600">{error}</div>
        )}
        {category === "any" && (
          <p className="text-xs text-neutral-500">
            Email fires on every detected diff of the selected element.
          </p>
        )}
      </div>
    </Field>
  );
}

function Segmented({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1">
      {children}
    </div>
  );
}

function SegmentedButton({
  active,
  onClick,
  children,
  title,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  icon?: () => React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition " +
        (active
          ? "bg-brand text-black font-medium"
          : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800")
      }
    >
      {Icon && <span className="inline-flex shrink-0">{Icon()}</span>}
      <span>{children}</span>
    </button>
  );
}

function IconLessThan() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 6 7 12 15 18" />
    </svg>
  );
}

function IconGreaterThan() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 6 17 12 9 18" />
    </svg>
  );
}

function IconEquals() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <line x1="5" y1="9" x2="19" y2="9" />
      <line x1="5" y1="15" x2="19" y2="15" />
    </svg>
  );
}

function IconContains() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <line x1="7" y1="10" x2="15" y2="10" />
      <line x1="7" y1="14" x2="12" y2="14" />
    </svg>
  );
}

function IconNotContains() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <line x1="7" y1="10" x2="15" y2="10" />
      <line x1="7" y1="14" x2="12" y2="14" />
      <line x1="4" y1="20" x2="20" y2="4" />
    </svg>
  );
}

function IconRegex() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="4" x2="12" y2="14" />
      <line x1="7.5" y1="6.5" x2="16.5" y2="11.5" />
      <line x1="16.5" y1="6.5" x2="7.5" y2="11.5" />
      <circle cx="7" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
