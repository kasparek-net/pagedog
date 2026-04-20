import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_RENEW_THRESHOLD_MS,
  SESSION_TTL_MS,
  createSessionValue,
  parseSessionValue,
} from "@/lib/session";

const PUBLIC_PREFIXES = ["/sign-in", "/api/auth/", "/api/cron/"];

export default function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p))) {
    return NextResponse.next();
  }
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = parseSessionValue(cookie);
  if (!session) {
    if (path.startsWith("/api/")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  if (session.expiresAtMs - Date.now() < SESSION_RENEW_THRESHOLD_MS) {
    res.cookies.set({
      name: SESSION_COOKIE,
      value: createSessionValue(session.email),
      httpOnly: true,
      secure: req.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
  }
  return res;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
