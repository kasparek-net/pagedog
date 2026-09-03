// Shops behind Cloudflare bot management (Alza) answer 403 to anything coming
// from a datacenter IP, so their pages cannot be fetched from Vercel at all.
// Hlídač shopů tracks those shops itself and serves the price over an open API,
// which lets a blocked price watch still be checked.
const TRACKER_API = "https://api.hlidacshopu.cz/v2/detail";

type PricePoint = { x?: string; y?: number | null };

export async function fetchTrackedPrice(
  url: string,
  timeoutMs = 10000,
): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${TRACKER_API}?url=${encodeURIComponent(url)}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.json();
    const points: PricePoint[] = body?.data?.currentPrice ?? [];
    for (let i = points.length - 1; i >= 0; i--) {
      const y = points[i]?.y;
      if (typeof y === "number" && Number.isFinite(y)) return y;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function formatTrackedPrice(value: number): string {
  return `${new Intl.NumberFormat("cs-CZ").format(value)} Kč`;
}
