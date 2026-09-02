import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type ExtractErrorKind = "fetch" | "selector";

export type ExtractResult =
  | {
      ok: true;
      value: string;
      hash: string;
      imageUrl: string | null;
      faviconUrl: string | null;
    }
  | { ok: false; error: string; kind: ExtractErrorKind };

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;

const BOT_HEADERS: Record<string, string> = {
  "User-Agent": "PagedogBot/1.0 (+https://github.com/kasparek-net/pagedog)",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "cs,en;q=0.9",
};

type MinimalResponse = {
  status: number;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
  text(): Promise<string>;
};

let impit: import("impit").Impit | null = null;

async function requestOnce(
  url: string,
  impersonate: boolean,
  signal: AbortSignal,
): Promise<MinimalResponse> {
  if (!impersonate) {
    return fetch(url, {
      headers: BOT_HEADERS,
      redirect: "manual",
      signal,
      cache: "no-store",
    });
  }
  if (!impit) {
    const { Impit } = await import("impit");
    impit = new Impit({ browser: "chrome" });
  }
  return impit.fetch(url, {
    headers: { "Accept-Language": "cs,en;q=0.9" },
    redirect: "manual",
    signal,
  });
}

// Sites behind bot protection (Cloudflare et al.) reject our plain fetch on TLS
// fingerprint alone. Retry those through a client that impersonates Chrome.
function isBotBlock(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : "";
  return msg === "HTTP 403" || msg === "HTTP 429" || msg === "HTTP 503";
}

export async function fetchHtml(url: string, timeoutMs = 15000): Promise<string> {
  try {
    return await fetchHtmlWith(url, timeoutMs, false);
  } catch (e) {
    if (!isBotBlock(e)) throw e;
    return await fetchHtmlWith(url, timeoutMs, true);
  }
}

async function fetchHtmlWith(
  url: string,
  timeoutMs: number,
  impersonate: boolean,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = url;
    let res: MinimalResponse | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const parsed = new URL(current);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error(`Disallowed protocol: ${parsed.protocol}`);
      }
      await assertPublicHost(parsed.hostname);
      res = await requestOnce(current, impersonate, controller.signal);
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new Error("Redirect without Location header");
        current = new URL(loc, current).toString();
        continue;
      }
      break;
    }
    if (!res) throw new Error("Fetch failed");
    if (res.status >= 300 && res.status < 400) {
      throw new Error("Too many redirects");
    }
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`HTTP ${res.status}`);
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html") && !ct.includes("xml") && !ct.includes("text")) {
      throw new Error(`Unexpected content-type: ${ct}`);
    }
    const reader = res.body?.getReader();
    if (!reader) return await res.text();
    const decoder = new TextDecoder();
    let html = "";
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        reader.cancel().catch(() => {});
        throw new Error("Response too large (limit 5 MB)");
      }
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
    return html;
  } finally {
    clearTimeout(timer);
  }
}

export function isPrivateIp(ip: string): boolean {
  if (!isIP(ip)) return true;
  if (isIP(ip) === 4) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] >= 224) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe80")) return true;
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    return isPrivateIp(v4);
  }
  return false;
}

export async function assertPublicHost(hostname: string): Promise<void> {
  if (!hostname) throw new Error("Empty hostname");
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("Private IP not allowed");
    return;
  }
  if (/^localhost$/i.test(hostname) || hostname.endsWith(".localhost")) {
    throw new Error("Local hostname not allowed");
  }
  const results = await lookup(hostname, { all: true });
  for (const r of results) {
    if (isPrivateIp(r.address)) throw new Error("Resolves to private IP");
  }
}

export function extractFromHtml(
  html: string,
  selector: string,
  baseUrl?: string,
): ExtractResult {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch {
    return { ok: false, error: "HTML parse error", kind: "fetch" };
  }
  let el;
  try {
    el = $(selector).first();
  } catch {
    return { ok: false, error: "Invalid CSS selector", kind: "selector" };
  }
  if (el.length === 0)
    return { ok: false, error: "Selector matched no element", kind: "selector" };
  const text = el.text().replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, error: "Element is empty", kind: "selector" };
  const imageUrl = baseUrl ? extractOgImage($, baseUrl) : null;
  const faviconUrl = baseUrl ? extractFavicon($, baseUrl) : null;
  return { ok: true, value: text, hash: sha256(text), imageUrl, faviconUrl };
}

function extractOgImage(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): string | null {
  const candidates = [
    $('meta[property="og:image:secure_url"]').attr("content"),
    $('meta[property="og:image:url"]').attr("content"),
    $('meta[property="og:image"]').attr("content"),
    $('meta[name="twitter:image"]').attr("content"),
    $('meta[name="twitter:image:src"]').attr("content"),
  ];
  for (const raw of candidates) {
    const resolved = resolveImageUrl(raw, baseUrl);
    if (resolved) return resolved;
  }
  return null;
}

function extractFavicon(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): string | null {
  const links = $(
    'link[rel~="icon" i], link[rel="shortcut icon" i], link[rel="apple-touch-icon" i], link[rel="apple-touch-icon-precomposed" i]',
  )
    .toArray()
    .map((el) => {
      const $el = $(el);
      const href = $el.attr("href");
      const rel = ($el.attr("rel") ?? "").toLowerCase();
      const sizes = $el.attr("sizes") ?? "";
      const maxSize = sizes
        .split(/\s+/)
        .map((s) => {
          const n = parseInt(s.split("x")[0] ?? "", 10);
          return Number.isFinite(n) ? n : 0;
        })
        .reduce((a, b) => Math.max(a, b), 0);
      return { href, rel, maxSize };
    })
    .filter((l): l is { href: string; rel: string; maxSize: number } => !!l.href);

  links.sort((a, b) => {
    const aTouch = a.rel.includes("apple-touch-icon") ? 1 : 0;
    const bTouch = b.rel.includes("apple-touch-icon") ? 1 : 0;
    if (aTouch !== bTouch) return bTouch - aTouch;
    return b.maxSize - a.maxSize;
  });

  for (const l of links) {
    const resolved = resolveImageUrl(l.href, baseUrl);
    if (resolved) return resolved;
  }
  try {
    return new URL("/favicon.ico", baseUrl).toString();
  } catch {
    return null;
  }
}

function resolveImageUrl(raw: string | undefined, baseUrl: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const abs = new URL(trimmed, baseUrl);
    if (abs.protocol !== "http:" && abs.protocol !== "https:") return null;
    return abs.toString();
  } catch {
    return null;
  }
}

export async function fetchAndExtract(
  url: string,
  selector: string,
): Promise<ExtractResult> {
  let html: string;
  try {
    html = await fetchHtml(url);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Fetch failed",
      kind: "fetch",
    };
  }
  return extractFromHtml(html, selector, url);
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
