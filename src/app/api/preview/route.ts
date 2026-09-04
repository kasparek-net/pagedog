import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { getSessionEmail } from "@/lib/session";
import { extractFromHtml, assertPublicHost, isBotBlock } from "@/lib/extract";
import { fetchTrackedPrice, formatTrackedPrice } from "@/lib/price-tracker";
import { rateLimit } from "@/lib/rate-limit";
import { fetchPageAnywhere } from "@/lib/fetch-page";
import { productFromHtml } from "@/lib/product-data";
import { PICKER_JS } from "@/lib/picker-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function buildHighlightScript(selector: string): string {
  const safe = JSON.stringify(selector);
  return `(function(){function go(){try{var el=document.querySelector(${safe});if(!el)return;var s=document.createElement('style');s.textContent='[data-pd-hl]{outline:3px solid #eabf43!important;outline-offset:3px;background:rgba(234,191,67,0.12)!important;animation:pdHlPulse 1.4s ease-in-out infinite}@keyframes pdHlPulse{0%,100%{outline-color:#eabf43}50%{outline-color:#d4a92e}}html,body{cursor:default!important}a,button{pointer-events:none!important}';document.documentElement.appendChild(s);el.setAttribute('data-pd-hl','1');el.scrollIntoView({block:'center',behavior:'instant'});}catch(e){}}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',go);}else{go();}})();`;
}

export async function GET(req: NextRequest) {
  const email = await getSessionEmail();
  if (!email) return new NextResponse("Unauthorized", { status: 401 });

  const rl = rateLimit("preview", email, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a moment." },
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
    return NextResponse.json({ error: "Only http(s) URLs are allowed" }, { status: 400 });
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
    html = await fetchPageAnywhere(url.toString());
  } catch (e) {
    const status = e instanceof Error ? e.message : "Fetch failed";
    // Blocked here and no agent around to ask: a watch on it may still work
    // through the price tracker, so say so instead of a bare 403.
    if (isBotBlock(e)) {
      const tracked = await fetchTrackedPrice(url.toString());
      return NextResponse.json(
        {
          error: tracked.ok
            ? `${status} — this shop blocks previews and the local agent is offline, but its price is tracked externally (currently ${formatTrackedPrice(tracked.price)}).`
            : `${status} — this shop blocks previews and the local agent is offline (${tracked.reason}).`,
        },
        { status: 502 },
      );
    } else {
      return NextResponse.json({ error: status }, { status: 502 });
    }
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
  $("meta[http-equiv]").remove();
  $("*").each((_, el) => {
    const attribs = (el as { attribs?: Record<string, string> }).attribs ?? {};
    for (const k of Object.keys(attribs)) {
      if (k.toLowerCase().startsWith("on")) $(el).removeAttr(k);
    }
  });

  if ($("base").length === 0) {
    $("head").prepend(`<base href="${url.toString()}">`);
  }

  const inlineScript =
    mode === "view" && selector
      ? buildHighlightScript(selector)
      : PICKER_JS;
  const safeScript = inlineScript.replace(/<\/script>/gi, "<\\/script>");
  $("head").append(`<style>html,body{margin:0}</style><script>${safeScript}</script>`);

  const out = $.html();
  return new NextResponse(out, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'self' data: blob: http: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' http: https:; img-src * data: blob:; font-src * data:;",
      "X-Frame-Options": "SAMEORIGIN",
      // Ride along with the preview so the form can offer price and
      // availability without making the agent fetch the page a second time.
      "x-pagedog-product": encodeURIComponent(JSON.stringify(productFromHtml(html))),
    },
  });
}
