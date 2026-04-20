import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "pd_session";
const MAGIC_TTL_MS = 15 * 60 * 1000;
export const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;
export const SESSION_RENEW_THRESHOLD_MS = 60 * 24 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET not configured");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function createMagicToken(email: string): string {
  const exp = Date.now() + MAGIC_TTL_MS;
  const payload = `${email.toLowerCase()}|${exp}`;
  const sig = sign(payload);
  return Buffer.from(`${payload}|${sig}`).toString("base64url");
}

export function verifyMagicToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split("|");
    if (parts.length !== 3) return null;
    const [email, expStr, sig] = parts;
    if (!safeEq(sig, sign(`${email}|${expStr}`))) return null;
    if (Number(expStr) < Date.now()) return null;
    return email;
  } catch {
    return null;
  }
}

export function createSessionValue(email: string): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${email.toLowerCase()}|${exp}`;
  return `${payload}|${sign(payload)}`;
}

export function verifySessionValue(value: string | undefined | null): string | null {
  const parsed = parseSessionValue(value);
  return parsed?.email ?? null;
}

export function parseSessionValue(
  value: string | undefined | null,
): { email: string; expiresAtMs: number } | null {
  if (!value) return null;
  const parts = value.split("|");
  if (parts.length !== 3) return null;
  const [email, expStr, sig] = parts;
  if (!safeEq(sig, sign(`${email}|${expStr}`))) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  return { email, expiresAtMs: exp };
}

export async function getSessionEmail(): Promise<string | null> {
  const store = await cookies();
  return verifySessionValue(store.get(SESSION_COOKIE)?.value);
}

export async function requireSessionEmail(): Promise<string> {
  const email = await getSessionEmail();
  if (!email) throw new Response("Unauthorized", { status: 401 });
  return email;
}

export function parseAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(email: string): boolean {
  const list = parseAllowedEmails();
  if (list.length === 0) return false;
  return list.includes(email.toLowerCase());
}
