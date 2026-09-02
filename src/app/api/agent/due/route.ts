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

  return NextResponse.json({
    watches: due.map((w) => ({ id: w.id, url: w.url, selector: w.selector })),
  });
}
