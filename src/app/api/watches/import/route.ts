import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionEmail } from "@/lib/session";
import { db } from "@/lib/db";
import { assertPublicHost, extractFromHtml } from "@/lib/extract";
import { fetchPageAnywhere } from "@/lib/fetch-page";
import { productFromHtml } from "@/lib/product-data";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  url: z.string().url().max(2000),
  intervalMinutes: z.number().int().min(1).max(10080).default(60),
});

// One product URL in, one watch out. Product pages need no selector, so a
// list of links can become a list of watches without a picker in between.
export async function POST(req: NextRequest) {
  const email = await getSessionEmail();
  if (!email) return new NextResponse("Unauthorized", { status: 401 });

  const rl = rateLimit("import", email, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many imports at once. Try again in a minute." }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  const { url, intervalMinutes } = parsed.data;

  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "Only http(s) URLs are allowed" }, { status: 400 });
  }
  try {
    await assertPublicHost(parsedUrl.hostname);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Host not allowed" }, { status: 400 });
  }

  const existing = await db.watch.findFirst({ where: { userId: email, url }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "Already watching this URL", id: existing.id }, { status: 409 });

  let html: string;
  try {
    html = await fetchPageAnywhere(url);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Fetch failed" }, { status: 502 });
  }

  const product = productFromHtml(html);
  const selector = product.availability ? "@availability" : product.price ? "@price" : null;
  if (!selector) {
    return NextResponse.json(
      { error: "Not a product page — add it with a selector instead" },
      { status: 422 },
    );
  }

  const initial = extractFromHtml(html, selector, url);
  const watch = await db.watch.create({
    data: {
      userId: email,
      label: product.name ?? parsedUrl.hostname.replace(/^www\./, ""),
      url,
      selector,
      notifyEmail: email,
      lastValue: initial.ok ? initial.value : null,
      lastHash: initial.ok ? initial.hash : null,
      imageUrl: initial.ok ? initial.imageUrl : null,
      faviconUrl: initial.ok ? initial.faviconUrl : null,
      lastError: initial.ok ? null : initial.error,
      lastCheckedAt: new Date(),
      intervalMinutes,
      conditionType: "change",
    },
  });
  return NextResponse.json(
    { id: watch.id, label: watch.label, selector, value: initial.ok ? initial.value : null },
    { status: 201 },
  );
}
