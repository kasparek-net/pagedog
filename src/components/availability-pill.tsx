import { availabilityTone } from "@/lib/product-data";

const TONE_CLASS = {
  good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  bad: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  neutral: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
} as const;

export function AvailabilityPill({ value, size = "sm" }: { value: string; size?: "sm" | "md" }) {
  const tone = availabilityTone(value);
  const dot =
    tone === "good" ? "bg-emerald-500" : tone === "bad" ? "bg-red-500" : "bg-neutral-400";
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full font-medium " +
        (size === "md" ? "px-2.5 py-1 text-sm " : "px-2 py-0.5 text-xs ") +
        TONE_CLASS[tone]
      }
    >
      <span className={"h-1.5 w-1.5 rounded-full " + dot} aria-hidden />
      {value}
    </span>
  );
}
