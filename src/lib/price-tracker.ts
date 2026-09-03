// Shops behind Cloudflare bot management (Alza) answer 403 to anything coming
// from a datacenter IP, so their pages cannot be fetched from Vercel at all.
// Hlídač shopů tracks those shops itself and serves the price over an open API,
// which lets a blocked price watch still be checked.
const TRACKER_API = "https://api.hlidacshopu.cz/v2/detail";

type PricePoint = { x?: string; y?: number | null };

export type TrackedPrice =
  | { ok: true; price: number }
  | { ok: false; reason: string };

export async function fetchTrackedPrice(
  url: string,
  timeoutMs = 10000,
): Promise<TrackedPrice> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${TRACKER_API}?url=${encodeURIComponent(url)}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 404) return { ok: false, reason: "product not tracked" };
    if (!res.ok) return { ok: false, reason: `tracker HTTP ${res.status}` };
    const body = await res.json();
    const points: PricePoint[] = body?.data?.currentPrice ?? [];
    for (let i = points.length - 1; i >= 0; i--) {
      const y = points[i]?.y;
      if (typeof y === "number" && Number.isFinite(y)) return { ok: true, price: y };
    }
    return { ok: false, reason: "tracker has no price yet" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "request failed";
    return { ok: false, reason: `tracker unreachable: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

export function formatTrackedPrice(value: number): string {
  return `${new Intl.NumberFormat("cs-CZ").format(value)} Kč`;
}
