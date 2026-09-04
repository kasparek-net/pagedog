import { db } from "@/lib/db";

// Phone push through ntfy: a restock alert read an hour later in the inbox is
// worth little. Publishing as JSON keeps titles with diacritics out of HTTP
// headers.
const NTFY_URL = (process.env.NTFY_URL ?? "https://ntfy.sh").replace(/\/$/, "");

export type Push = {
  title: string;
  message: string;
  click?: string;
  priority?: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
};

export async function sendPush(topic: string, push: Push): Promise<void> {
  const res = await fetch(NTFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      title: push.title,
      message: push.message,
      ...(push.click ? { click: push.click } : {}),
      priority: push.priority ?? 3,
      ...(push.tags?.length ? { tags: push.tags } : {}),
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ntfy HTTP ${res.status}`);
}

// Best-effort push to whoever owns the watch; silently a no-op without a topic.
export async function pushTo(userId: string, push: Push): Promise<boolean> {
  const settings = await db.userSettings.findUnique({ where: { email: userId } });
  if (!settings?.ntfyTopic) return false;
  try {
    await sendPush(settings.ntfyTopic, push);
    return true;
  } catch (e) {
    console.error("[push] failed", e);
    return false;
  }
}

export const NTFY_TOPIC_RE = /^[A-Za-z0-9_-]{1,64}$/;
