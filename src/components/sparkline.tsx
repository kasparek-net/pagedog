export function Sparkline({
  values,
  width = 76,
  height = 26,
  title,
}: {
  values: number[];
  width?: number;
  height?: number;
  title?: string;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const flat = max === min;
  const pad = 3;
  const usable = height - pad * 2;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = flat ? height / 2 : pad + (1 - (v - min) / (max - min)) * usable;
    return [x, y] as const;
  });

  const line = points.map(([x, y]) => `${round(x)},${round(y)}`).join(" ");
  const area = `${line} ${width},${height} 0,${height}`;
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 overflow-visible text-neutral-700 dark:text-neutral-300"
      aria-hidden
    >
      {title && <title>{title}</title>}
      <polygon points={area} fill="currentColor" opacity={0.1} />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={round(lastX)} cy={round(lastY)} r={2.4} fill="currentColor" />
    </svg>
  );
}

function round(n: number): string {
  return n.toFixed(1);
}
