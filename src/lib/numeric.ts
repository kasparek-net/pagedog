const NUMBER_RE = /-?\d+(?:[ \u00a0\u202f.,]\d{3})*(?:[.,]\d+)?/;

const MAX_NUMERIC_TEXT_LENGTH = 40;

export function parseNumber(text: string | null): number | null {
  if (!text) return null;
  const m = text.replace(/[\u00a0\u202f]/g, " ").match(NUMBER_RE);
  if (!m) return null;

  const raw = m[0].replace(/[ '’]/g, "");
  const lastSep = Math.max(raw.lastIndexOf(","), raw.lastIndexOf("."));
  let normalized: string;
  if (lastSep === -1) {
    normalized = raw;
  } else {
    const decimals = raw.length - lastSep - 1;
    const head = raw.slice(0, lastSep).replace(/[.,]/g, "");
    // Three digits after the last separator is a thousands group ("1.500"),
    // unless the integer part is a bare zero ("0.123").
    const isDecimalSep = decimals !== 3 || /^-?0$/.test(head);
    normalized = isDecimalSep ? `${head}.${raw.slice(lastSep + 1)}` : head + raw.slice(lastSep + 1);
  }

  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

// A value counts as numeric only when the tracked text is short enough to be a
// price / count rather than a paragraph that happens to contain a digit.
export function isNumericValue(text: string | null): boolean {
  if (!text) return false;
  if (text.trim().length > MAX_NUMERIC_TEXT_LENGTH) return false;
  return parseNumber(text) !== null;
}

export type NumericPoint = { n: number; label: string };

export function buildSeries(values: (string | null)[]): NumericPoint[] {
  const points: NumericPoint[] = [];
  for (const v of values) {
    if (!isNumericValue(v)) continue;
    const n = parseNumber(v);
    if (n === null) continue;
    const label = v!.trim();
    if (points.length && points[points.length - 1].label === label) continue;
    points.push({ n, label });
  }
  return points;
}
