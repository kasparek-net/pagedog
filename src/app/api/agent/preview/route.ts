import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAgentAuth } from "@/lib/agent-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_HTML_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const auth = checkAgentAuth(req);
  if (!auth.ok) return new NextResponse(auth.msg, { status: auth.status });

  const body = await req.json().catch(() => null);
  const jobId = typeof body?.jobId === "string" ? body.jobId : null;
  const html = typeof body?.html === "string" ? body.html : null;
  const error = typeof body?.error === "string" ? body.error : null;
  if (!jobId || (html === null && error === null)) {
    return NextResponse.json({ error: "jobId and html or error required" }, { status: 400 });
  }
  if (html !== null && Buffer.byteLength(html) > MAX_HTML_BYTES) {
    return NextResponse.json({ error: "html too large" }, { status: 413 });
  }

  const job = await db.previewJob.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db.previewJob.update({
    where: { id: jobId },
    data: { html, error, doneAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
