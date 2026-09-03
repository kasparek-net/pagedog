import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAgentAuth } from "@/lib/agent-auth";
import { isAgentHost } from "@/lib/agent-hosts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = checkAgentAuth(req);
  if (!auth.ok) return new NextResponse(auth.msg, { status: auth.status });

  const all = await db.watch.findMany({ where: { isActive: true } });
  const now = Date.now();
  const due = all.filter((w) => {
    if (!isAgentHost(w.url)) return false;
    if (!w.lastCheckedAt) return true;
    const elapsed = now - w.lastCheckedAt.getTime();
    return elapsed >= w.intervalMinutes * 60_000 - 30_000;
  });

  // Previews are interactive, so they ride along on the poll the agent already
  // makes rather than getting a request of their own.
  const previewJobs = await db.previewJob.findMany({
    where: { doneAt: null, createdAt: { gt: new Date(now - 2 * 60_000) } },
    orderBy: { createdAt: "asc" },
    take: 3,
    select: { id: true, url: true },
  });

  return NextResponse.json({
    watches: due.map((w) => ({ id: w.id, url: w.url, selector: w.selector })),
    previewJobs,
  });
}
