import { NextRequest, NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/session";
import { db } from "@/lib/db";
import { processWatch } from "@/lib/check-watch";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const email = await getSessionEmail();
  if (!email) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const watch = await db.watch.findFirst({ where: { id, userId: email } });
  if (!watch) return new NextResponse("Not found", { status: 404 });

  const rl = rateLimit("check-now", `${email}:${id}`, 6, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many checks. Try again in a few seconds." },
      { status: 429 },
    );
  }

  const status = await processWatch(watch);
  return NextResponse.json({ status });
}
