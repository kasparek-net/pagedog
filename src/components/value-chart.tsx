// Stretches to the container width, so the coordinate system is normalized and
// strokes are kept at their authored width with vector-effect.
export function ValueChart({ values, height = 150 }: { values: number[]; height?: number }) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const flat = max === min;
  const pad = 8;
  const usable = height - pad * 2;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 1000;
    const y = flat ? height / 2 : pad + (1 - (v - min) / (max - min)) * usable;
    return [x, y] as const;
  });

  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} 1000,${height} 0,${height}`;

  return (
    <svg
      viewBox={`0 0 1000 ${height}`}
      preserveAspectRatio="none"
      height={height}
      className="w-full text-neutral-700 dark:text-neutral-300"
      aria-hidden
    >
      <line
        x1="0"
        y1={pad}
        x2="1000"
        y2={pad}
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 4"
        opacity={0.25}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1="0"
        y1={height - pad}
        x2="1000"
        y2={height - pad}
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 4"
        opacity={0.25}
        vectorEffect="non-scaling-stroke"
      />
      <polygon points={area} fill="currentColor" opacity={0.1} />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
