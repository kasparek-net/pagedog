import { NextRequest, NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/session";
import { db } from "@/lib/db";
import { sendChangeNotification } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Sends the real change email with sample values, so people can see that
// notifications actually arrive before they depend on one.
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const email = await getSessionEmail();
  if (!email) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const watch = await db.watch.findFirst({ where: { id, userId: email } });
  if (!watch) return new NextResponse("Not found", { status: 404 });

  const rl = rateLimit("test-email", `${email}:${id}`, 3, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Three test emails per ten minutes is plenty. Try again later." },
      { status: 429 },
    );
  }

  try {
    await sendChangeNotification({
      to: watch.notifyEmail,
      label: `${watch.label} (test)`,
      url: watch.url,
      oldValue: watch.lastValue ?? "previous value",
      newValue: `${watch.lastValue ?? "new value"} — this is a test`,
      watchId: watch.id,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sending failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, to: watch.notifyEmail });
}
