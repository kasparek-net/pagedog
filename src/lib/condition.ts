import { parseNumber } from "@/lib/numeric";

export const CONDITION_TYPES = [
  "change",
  "contains",
  "not_contains",
  "equals",
  "regex",
  "number_lt",
  "number_gt",
  "drop_pct",
  "lowest",
] as const;

export type ConditionType = (typeof CONDITION_TYPES)[number];

export type Condition = { type: ConditionType; value: string | null };

export const CONDITION_OPTIONS: {
  value: ConditionType;
  label: string;
  needsValue: boolean;
  valueKind: "none" | "text" | "number";
  placeholder?: string;
}[] = [
  { value: "change", label: "Anything changes", needsValue: false, valueKind: "none" },
  { value: "contains", label: "Text contains", needsValue: true, valueKind: "text", placeholder: "In stock" },
  { value: "not_contains", label: "Text does not contain", needsValue: true, valueKind: "text", placeholder: "Sold out" },
  { value: "equals", label: "Text equals", needsValue: true, valueKind: "text", placeholder: "Available" },
  { value: "regex", label: "Matches regex", needsValue: true, valueKind: "text", placeholder: "\\d+\\s?€" },
  { value: "number_lt", label: "Number is less than", needsValue: true, valueKind: "number", placeholder: "1000" },
  { value: "number_gt", label: "Number is greater than", needsValue: true, valueKind: "number", placeholder: "0" },
  { value: "drop_pct", label: "Price drops by at least %", needsValue: true, valueKind: "number", placeholder: "10" },
  { value: "lowest", label: "New lowest price ever", needsValue: false, valueKind: "none" },
];

export function optionFor(type: ConditionType) {
  return CONDITION_OPTIONS.find((o) => o.value === type) ?? CONDITION_OPTIONS[0];
}

export function isValidRegex(src: string): boolean {
  try {
    new RegExp(src);
    return true;
  } catch {
    return false;
  }
}

export function extractFirstNumber(text: string): number | null {
  return parseNumber(text);
}

export function evaluate(text: string | null, c: Condition): boolean {
  if (c.type === "change") return true;
  if (text === null) return false;
  const v = c.value ?? "";
  switch (c.type) {
    case "contains":
      return text.toLowerCase().includes(v.toLowerCase());
    case "not_contains":
      return !text.toLowerCase().includes(v.toLowerCase());
    case "equals":
      return text.trim().toLowerCase() === v.trim().toLowerCase();
    case "regex": {
      try {
        return new RegExp(v, "i").test(text);
      } catch {
        return false;
      }
    }
    case "number_lt": {
      const n = extractFirstNumber(text);
      const t = Number(v);
      return n !== null && Number.isFinite(t) && n < t;
    }
    case "number_gt": {
      const n = extractFirstNumber(text);
      const t = Number(v);
      return n !== null && Number.isFinite(t) && n > t;
    }
    // Movement conditions cannot be judged from one value; see evaluateTransition.
    case "drop_pct":
    case "lowest":
      return false;
    default:
      return false;
  }
}

// Whether going from `previous` to `next` should notify. Threshold conditions
// fire on entering the state; movement conditions compare against the past.
export function evaluateTransition(
  previous: string,
  next: string,
  c: Condition,
  historyMin: number | null,
): boolean {
  switch (c.type) {
    case "change":
      return true;
    case "drop_pct": {
      const o = parseNumber(previous);
      const n = parseNumber(next);
      const pct = Number(c.value);
      return o !== null && n !== null && o > 0 && Number.isFinite(pct) && ((o - n) / o) * 100 >= pct;
    }
    case "lowest": {
      const n = parseNumber(next);
      return n !== null && historyMin !== null && n < historyMin;
    }
    default:
      return !evaluate(previous, c) && evaluate(next, c);
  }
}

export function conditionLabel(type: ConditionType, value: string | null): string {
  const o = optionFor(type);
  if (!o.needsValue) return o.label;
  if (type === "drop_pct") return `Price drops by ≥ ${value ?? "?"} %`;
  return `${o.label} "${value ?? ""}"`;
}
