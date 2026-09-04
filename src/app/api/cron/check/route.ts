import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { processWatch } from "@/lib/check-watch";
import { isAgentHost } from "@/lib/agent-hosts";
import { isDue } from "@/lib/schedule";
import { agentHealth, markAgentStaleNotified } from "@/lib/agent-status";
import { sendAgentDownNotification } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CHECK_LOG_TTL_DAYS = 30;
const PREVIEW_JOB_TTL_MS = 10 * 60_000;

function checkAuth(req: NextRequest): { ok: true } | { ok: false; status: number; msg: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { ok: false, status: 503, msg: "CRON_SECRET not configured" };
  }
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return { ok: false, status: 401, msg: "Unauthorized" };
  if (!timingSafeEqual(Buffer.from(header), Buffer.from(expected))) {
    return { ok: false, status: 401, msg: "Unauthorized" };
  }
  return { ok: true };
}

async function cleanupOldChecks() {
  const cutoff = new Date(Date.now() - CHECK_LOG_TTL_DAYS * 24 * 60 * 60 * 1000);
  const res = await db.check.deleteMany({ where: { checkedAt: { lt: cutoff } } });
  // Preview jobs that were never collected (timed out, agent offline) still
  // hold a full page each.
  await db.previewJob.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - PREVIEW_JOB_TTL_MS) } },
  });
  return res.count;
}

// The agent is a single machine at home; if it stops polling, every watch it
// owns goes quiet with no error anywhere. Tell the owners once per outage.
async function alertIfAgentDown() {
  const agentWatches = (await db.watch.findMany({ where: { isActive: true } })).filter((w) =>
    isAgentHost(w.url),
  );
  if (agentWatches.length === 0) return;
  const health = await agentHealth();
  // Never having connected is a setup state, not an outage.
  if (!health.lastSeenAt || !health.stale || health.staleNotifiedAt) return;
  const hosts = [...new Set(agentWatches.map((w) => new URL(w.url).hostname))];
  const recipients = [...new Set(agentWatches.map((w) => w.notifyEmail))];
  for (const to of recipients) {
    try {
      await sendAgentDownNotification({ to, lastSeenAt: health.lastSeenAt, hosts });
    } catch (e) {
      console.error("[cron] agent-down email failed", e);
    }
  }
  await markAgentStaleNotified();
}

async function runChecks() {
  const purged = await cleanupOldChecks();
  await alertIfAgentDown();
  const all = await db.watch.findMany({ where: { isActive: true } });
  const now = Date.now();
  const due = all.filter((w) => {
    // Hosts that block our IP are handled by the local agent instead.
    if (isAgentHost(w.url)) return false;
    return isDue(w, now);
  });
  const concurrency = 5;
  let changed = 0;
  let same = 0;
  let errors = 0;
  for (let i = 0; i < due.length; i += concurrency) {
    const slice = due.slice(i, i + concurrency);
    const results = await Promise.all(slice.map(processWatch));
    for (const r of results) {
      if (r === "changed") changed++;
      else if (r === "same") same++;
      else errors++;
    }
  }
  return { active: all.length, checked: due.length, changed, same, errors, purged };
}

export async function POST(req: NextRequest) {
  const auth = checkAuth(req);
  if (!auth.ok) return new NextResponse(auth.msg, { status: auth.status });
  const summary = await runChecks();
  return NextResponse.json(summary);
}
