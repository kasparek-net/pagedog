import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSessionValue,
  isAllowed,
  verifyMagicToken,
} from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return new NextResponse("Missing token", { status: 400 });
  }
  const email = verifyMagicToken(token);
  if (!email || !isAllowed(email)) {
    return new NextResponse("Invalid or expired link", { status: 401 });
  }
  const value = createSessionValue(email);
  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  const res = NextResponse.redirect(url);
  res.cookies.set({
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
