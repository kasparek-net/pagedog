import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAgentAuth } from "@/lib/agent-auth";
import { isAgentHost } from "@/lib/agent-hosts";
import { applyResult } from "@/lib/check-watch";
import { extractFromHtml, type ExtractResult } from "@/lib/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_HTML_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const auth = checkAgentAuth(req);
  if (!auth.ok) return new NextResponse(auth.msg, { status: auth.status });

  const body = await req.json().catch(() => null);
  const watchId = typeof body?.watchId === "string" ? body.watchId : null;
  const html = typeof body?.html === "string" ? body.html : null;
  const fetchError = typeof body?.error === "string" ? body.error : null;
  const durationMs = typeof body?.durationMs === "number" ? body.durationMs : 0;
  if (!watchId || (html === null && fetchError === null)) {
    return NextResponse.json({ error: "watchId and html or error required" }, { status: 400 });
  }
  if (html !== null && Buffer.byteLength(html) > MAX_HTML_BYTES) {
    return NextResponse.json({ error: "html too large" }, { status: 413 });
  }

  const watch = await db.watch.findUnique({ where: { id: watchId } });
  if (!watch) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!isAgentHost(watch.url)) {
    return NextResponse.json({ error: "watch is not agent-handled" }, { status: 409 });
  }

  const result: ExtractResult =
    html !== null
      ? extractFromHtml(html, watch.selector, watch.url)
      : { ok: false, error: fetchError!, kind: "fetch" };

  const outcome = await applyResult(watch, result, durationMs);
  return NextResponse.json({ result: outcome });
}
