import { NextRequest, NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/session";
import { z } from "zod";
import { db } from "@/lib/db";
import { CONDITION_TYPES, isValidRegex, optionFor, type ConditionType } from "@/lib/condition";

export const runtime = "nodejs";

const PatchSchema = z
  .object({
    label: z.string().min(1).max(100).optional(),
    notifyEmail: z.string().email().max(200).optional(),
    isActive: z.boolean().optional(),
    intervalMinutes: z.number().int().min(1).max(10080).optional(),
    conditionType: z.enum(CONDITION_TYPES).optional(),
    conditionValue: z.string().max(500).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.conditionType) return;
    const opt = optionFor(data.conditionType as ConditionType);
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
  });

async function getOwned(id: string, userId: string) {
  const watch = await db.watch.findFirst({ where: { id, userId } });
  return watch;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionEmail();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const watch = await getOwned(id, userId);
  if (!watch) return new NextResponse("Not found", { status: 404 });
  const changes = await db.change.findMany({
    where: { watchId: id },
    orderBy: { detectedAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ watch, changes });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionEmail();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const watch = await getOwned(id, userId);
  if (!watch) return new NextResponse("Not found", { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const updated = await db.watch.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ watch: updated });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionEmail();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const watch = await getOwned(id, userId);
  if (!watch) return new NextResponse("Not found", { status: 404 });
  await db.watch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
