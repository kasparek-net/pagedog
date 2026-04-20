import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { fetchAndExtract } from "@/lib/extract";
import { sendChangeNotification } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

async function processWatch(watch: {
  id: string;
  url: string;
  selector: string;
  label: string;
  notifyEmail: string;
  lastValue: string | null;
  lastHash: string | null;
}): Promise<"changed" | "same" | "error"> {
  const result = await fetchAndExtract(watch.url, watch.selector);
  if (!result.ok) {
    await db.watch.update({
      where: { id: watch.id },
      data: { lastCheckedAt: new Date(), lastError: result.error },
    });
    return "error";
  }
  if (watch.lastHash === result.hash) {
    await db.watch.update({
      where: { id: watch.id },
      data: { lastCheckedAt: new Date(), lastError: null },
    });
    return "same";
  }
  if (watch.lastHash !== null && watch.lastValue !== null) {
    await db.change.create({
      data: {
        watchId: watch.id,
        oldValue: watch.lastValue,
        newValue: result.value,
      },
    });
    try {
      await sendChangeNotification({
        to: watch.notifyEmail,
        label: watch.label,
        url: watch.url,
        oldValue: watch.lastValue,
        newValue: result.value,
        watchId: watch.id,
      });
    } catch (e) {
      console.error("[cron] email send failed", e);
    }
  }
  await db.watch.update({
    where: { id: watch.id },
    data: {
      lastCheckedAt: new Date(),
      lastValue: result.value,
      lastHash: result.hash,
      lastError: null,
    },
  });
  return "changed";
}

async function runChecks() {
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
  return { active: all.length, checked: due.length, changed, same, errors };
}

export async function POST(req: NextRequest) {
  const auth = checkAuth(req);
  if (!auth.ok) return new NextResponse(auth.msg, { status: auth.status });
  const summary = await runChecks();
  return NextResponse.json(summary);
}
