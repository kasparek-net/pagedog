import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/session";
import { db } from "@/lib/db";
import { sendPush } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST() {
  const email = await getSessionEmail();
  if (!email) return new NextResponse("Unauthorized", { status: 401 });

  const rl = rateLimit("test-push", email, 5, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many test pushes. Try again later." }, { status: 429 });
  }

  const settings = await db.userSettings.findUnique({ where: { email } });
  if (!settings?.ntfyTopic) {
    return NextResponse.json({ error: "Save a topic first" }, { status: 400 });
  }
  try {
    await sendPush(settings.ntfyTopic, {
      title: "Pagedog test",
      message: "Push notifications work. Alerts for your watches will arrive like this.",
      click: process.env.APP_URL ?? undefined,
      priority: 3,
      tags: ["dog"],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sending failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
