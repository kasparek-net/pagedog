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

// `changes` newest first, as stored; the resulting series runs oldest to newest
// and always ends at the watch's current value.
export function seriesFromChanges(
  changes: { oldValue: string; newValue: string }[],
  lastValue: string | null,
): NumericPoint[] {
  if (!isNumericValue(lastValue)) return [];
  const chronological = [...changes].reverse();
  const values: (string | null)[] = chronological.length
    ? [chronological[0].oldValue, ...chronological.map((c) => c.newValue)]
    : [];
  values.push(lastValue);
  return buildSeries(values);
}

export function summarizeSeries(series: NumericPoint[]) {
  if (series.length === 0) return null;
  const values = series.map((p) => p.n);
  const last = values[values.length - 1];
  const prev = values.length > 1 ? values[values.length - 2] : null;
  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    values,
    current: series[series.length - 1].label,
    oldest: series[0].label,
    previous: prev !== null ? series[series.length - 2].label : null,
    lowest: series[values.indexOf(min)].label,
    highest: series[values.indexOf(max)].label,
    deltaPct:
      prev !== null && prev !== 0 && prev !== last ? ((last - prev) / Math.abs(prev)) * 100 : null,
    isLowest: values.length >= 3 && last === min && min !== max,
  };
}

export function formatDeltaPct(pct: number): string {
  const abs = Math.abs(pct);
  return `${abs < 10 ? abs.toFixed(1) : Math.round(abs)}%`;
}

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
