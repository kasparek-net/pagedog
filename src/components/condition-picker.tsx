"use client";

import { isValidRegex, optionFor, type ConditionType } from "@/lib/condition";
import { Field } from "./field";

type Category = "any" | "text" | "number";

const CATEGORIES: { value: Category; label: string; hint: string }[] = [
  { value: "any", label: "Anything changes", hint: "Fire on any diff" },
  { value: "text", label: "Text match", hint: "Compare the extracted text" },
  { value: "number", label: "Number", hint: "Compare the first number found" },
];

const TEXT_OPS: { value: ConditionType; label: string; placeholder: string }[] = [
  { value: "contains", label: "contains", placeholder: "In stock" },
  { value: "not_contains", label: "doesn’t contain", placeholder: "Sold out" },
  { value: "equals", label: "equals", placeholder: "Available" },
  { value: "regex", label: "matches regex", placeholder: "\\d+\\s?€" },
];

const NUMBER_OPS: { value: ConditionType; label: string; placeholder: string }[] = [
  { value: "number_lt", label: "less than", placeholder: "1000" },
  { value: "number_gt", label: "greater than", placeholder: "0" },
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
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        "px-3 py-1.5 text-xs rounded-md transition " +
        (active
          ? "bg-brand text-black font-medium"
          : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800")
      }
    >
      {children}
    </button>
  );
}
