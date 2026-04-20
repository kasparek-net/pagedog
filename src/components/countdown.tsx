"use client";

import { useEffect, useState } from "react";

export function Countdown({
  targetMs,
  prefix = "in",
  overdue = "due now",
}: {
  targetMs: number;
  prefix?: string;
  overdue?: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return <span className="tabular-nums">—</span>;
  const diff = targetMs - now;
  if (diff <= 0) return <span className="tabular-nums">{overdue}</span>;
  return (
    <span className="inline-flex items-baseline gap-1 tabular-nums">
      {prefix && <span>{prefix}</span>}
      <Ticker text={format(diff)} />
    </span>
  );
}

function format(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return `${m}m ${pad(sec)}s`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h < 24) return `${h}h ${pad(min)}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function Ticker({ text }: { text: string }) {
  return (
    <span className="inline-flex items-baseline">
      {text.split("").map((c, i) => (
        <Char key={i} char={c} />
      ))}
    </span>
  );
}

function Char({ char }: { char: string }) {
  const idx = "0123456789".indexOf(char);
  if (idx === -1) return <span>{char}</span>;
  return (
    <span
      className="relative inline-block overflow-hidden align-baseline tabular-nums"
      style={{ height: "1em", lineHeight: 1, width: "0.62em" }}
    >
      <span
        className="block transition-transform duration-300 ease-out will-change-transform"
        style={{ transform: `translateY(-${idx}em)` }}
      >
        {DIGITS.map((n) => (
          <span key={n} className="block tabular-nums text-center" style={{ lineHeight: 1, height: "1em" }}>
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
