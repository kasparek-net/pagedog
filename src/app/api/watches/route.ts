import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fetchAndExtract, assertPublicHost } from "@/lib/extract";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_WATCHES_PER_USER = Number(process.env.MAX_WATCHES_PER_USER ?? 50);

const CreateSchema = z.object({
  label: z.string().min(1).max(100),
  url: z.string().url().max(2000),
  selector: z.string().min(1).max(500),
  notifyEmail: z.string().email().max(200),
  intervalMinutes: z.number().int().min(15).max(10080).default(60),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  const watches = await db.watch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { changes: true } } },
  });
  return NextResponse.json({ watches });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const rl = rateLimit("watches:create", userId, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Příliš mnoho požadavků, zkus to za chvíli." },
      { status: 429, headers: { "Retry-After": Math.ceil(rl.resetMs / 1000).toString() } },
    );
  }

  const count = await db.watch.count({ where: { userId } });
  if (count >= MAX_WATCHES_PER_USER) {
    return NextResponse.json(
      { error: `Limit ${MAX_WATCHES_PER_USER} hlídání na uživatele dosažen.` },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { label, url, selector, notifyEmail, intervalMinutes } = parsed.data;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "Pouze http(s) URL" }, { status: 400 });
  }
  try {
    await assertPublicHost(parsedUrl.hostname);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Host not allowed" },
      { status: 400 },
    );
  }

  const initial = await fetchAndExtract(url, selector);

  const watch = await db.watch.create({
    data: {
      userId,
      label,
      url,
      selector,
      notifyEmail,
      lastValue: initial.ok ? initial.value : null,
      lastHash: initial.ok ? initial.hash : null,
      lastError: initial.ok ? null : initial.error,
      lastCheckedAt: new Date(),
      intervalMinutes,
    },
  });
  return NextResponse.json({ watch }, { status: 201 });
}
