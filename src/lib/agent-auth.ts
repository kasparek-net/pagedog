import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export type AuthCheck = { ok: true } | { ok: false; status: number; msg: string };

export function checkAgentAuth(req: NextRequest): AuthCheck {
  const secret = process.env.AGENT_TOKEN;
  if (!secret) return { ok: false, status: 503, msg: "AGENT_TOKEN not configured" };
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return { ok: false, status: 401, msg: "Unauthorized" };
  if (!timingSafeEqual(Buffer.from(header), Buffer.from(expected))) {
    return { ok: false, status: 401, msg: "Unauthorized" };
  }
  return { ok: true };
}
