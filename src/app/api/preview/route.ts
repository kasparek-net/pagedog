import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { auth } from "@clerk/nextjs/server";
import { fetchHtml, extractFromHtml, assertPublicHost } from "@/lib/extract";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const rl = rateLimit("preview", userId, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Příliš mnoho požadavků, zkus to za chvíli." },
      {
        status: 429,
        headers: { "Retry-After": Math.ceil(rl.resetMs / 1000).toString() },
      },
    );
  }

  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return NextResponse.json({ error: "Pouze http(s) URL" }, { status: 400 });
  }
  try {
    await assertPublicHost(url.hostname);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Host not allowed" },
      { status: 400 },
    );
  }

  const mode = req.nextUrl.searchParams.get("mode");
  const selector = req.nextUrl.searchParams.get("selector");

  let html: string;
  try {
    html = await fetchHtml(url.toString());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fetch failed" },
      { status: 502 },
    );
  }

  if (mode === "test" && selector) {
    const result = extractFromHtml(html, selector);
    return NextResponse.json(result);
  }

  const $ = cheerio.load(html);
  $("script").remove();
  $("noscript").remove();
  $("link[rel='preload'][as='script']").remove();
  $("link[rel='modulepreload']").remove();
  $("*").each((_, el) => {
    const attribs = (el as { attribs?: Record<string, string> }).attribs ?? {};
    for (const k of Object.keys(attribs)) {
      if (k.toLowerCase().startsWith("on")) $(el).removeAttr(k);
    }
  });

  if ($("base").length === 0) {
    $("head").prepend(`<base href="${url.toString()}">`);
  }
  $("head").append(
    `<style>html,body{margin:0}</style>` +
      `<script src="/picker.js"></script>`,
  );

  const out = $.html();
  return new NextResponse(out, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'self' data: blob: http: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' http: https:; img-src * data: blob:; font-src * data:;",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
