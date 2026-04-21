import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { processWatch } from "@/lib/check-watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CHECK_LOG_TTL_DAYS = 30;

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
  return res.count;
}

async function runChecks() {
  const purged = await cleanupOldChecks();
  const all = await db.watch.findMany({ where: { isActive: true } });
  const now = Date.now();
  const due = all.filter((w) => {
    if (!w.lastCheckedAt) return true;
    const elapsed = now - w.lastCheckedAt.getTime();
    return elapsed >= w.intervalMinutes * 60_000 - 30_000;
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
