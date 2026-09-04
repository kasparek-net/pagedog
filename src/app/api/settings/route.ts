import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionEmail } from "@/lib/session";
import { db } from "@/lib/db";
import { NTFY_TOPIC_RE } from "@/lib/push";

export const runtime = "nodejs";

const Body = z.object({
  ntfyTopic: z
    .string()
    .trim()
    .max(64)
    .refine((v) => v === "" || NTFY_TOPIC_RE.test(v), {
      message: "Topic may only contain letters, digits, - and _",
    }),
});

export async function PATCH(req: NextRequest) {
  const email = await getSessionEmail();
  if (!email) return new NextResponse("Unauthorized", { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  // An empty field is a deliberate "off", not a fallback to anything.
  const ntfyTopic = parsed.data.ntfyTopic || null;
  const settings = await db.userSettings.upsert({
    where: { email },
    create: { email, ntfyTopic },
    update: { ntfyTopic },
  });
  return NextResponse.json({ ntfyTopic: settings.ntfyTopic });
}
