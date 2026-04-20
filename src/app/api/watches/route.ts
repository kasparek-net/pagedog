import { NextRequest, NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/session";
import { z } from "zod";
import { db } from "@/lib/db";
import { fetchAndExtract, assertPublicHost } from "@/lib/extract";
import { rateLimit } from "@/lib/rate-limit";
import { CONDITION_TYPES, isValidRegex, optionFor, type ConditionType } from "@/lib/condition";

export const runtime = "nodejs";

const MAX_WATCHES_PER_USER = Number(process.env.MAX_WATCHES_PER_USER ?? 50);

const CreateSchema = z
  .object({
    label: z.string().min(1).max(100),
    url: z.string().url().max(2000),
    selector: z.string().min(1).max(500),
    notifyEmail: z.string().email().max(200),
    intervalMinutes: z.number().int().min(15).max(10080).default(60),
    conditionType: z.enum(CONDITION_TYPES).default("change"),
    conditionValue: z.string().max(500).nullable().optional(),
  })
  .superRefine(refineCondition);

function refineCondition(
  data: { conditionType: ConditionType; conditionValue?: string | null },
  ctx: z.RefinementCtx,
) {
  const opt = optionFor(data.conditionType);
  if (!opt.needsValue) {
    data.conditionValue = null;
    return;
  }
  const v = data.conditionValue?.trim() ?? "";
  if (!v) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["conditionValue"], message: "Value required" });
    return;
  }
  if (data.conditionType === "regex" && !isValidRegex(v)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["conditionValue"], message: "Invalid regex" });
  }
  if (opt.valueKind === "number" && !Number.isFinite(Number(v))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["conditionValue"], message: "Must be a number" });
  }
  data.conditionValue = v;
}

export async function GET() {
  const userId = await getSessionEmail();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  const watches = await db.watch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { changes: true } } },
  });
  return NextResponse.json({ watches });
}

export async function POST(req: NextRequest) {
  const userId = await getSessionEmail();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const rl = rateLimit("watches:create", userId, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a moment." },
      { status: 429, headers: { "Retry-After": Math.ceil(rl.resetMs / 1000).toString() } },
    );
  }

  const count = await db.watch.count({ where: { userId } });
  if (count >= MAX_WATCHES_PER_USER) {
    return NextResponse.json(
      { error: `Limit of ${MAX_WATCHES_PER_USER} watches per user reached.` },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { label, url, selector, notifyEmail, intervalMinutes, conditionType, conditionValue } = parsed.data;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "Only http(s) URLs are allowed" }, { status: 400 });
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
      imageUrl: initial.ok ? initial.imageUrl : null,
      faviconUrl: initial.ok ? initial.faviconUrl : null,
      lastError: initial.ok ? null : initial.error,
      lastCheckedAt: new Date(),
      intervalMinutes,
      conditionType,
      conditionValue: conditionValue ?? null,
    },
  });
  return NextResponse.json({ watch }, { status: 201 });
}
