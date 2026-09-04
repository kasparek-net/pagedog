import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  OTP_TTL_MS,
  createMagicToken,
  generateOtp,
  hashOtp,
  isAllowed,
} from "@/lib/session";
import { sendMagicLink } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const Schema = z.object({ email: z.string().email().max(200) });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const ipRl = rateLimit("auth:request:ip", ip, 5, 60_000);
  if (!ipRl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a moment." },
      { status: 429, headers: { "Retry-After": Math.ceil(ipRl.resetMs / 1000).toString() } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  const emailRl = rateLimit("auth:request:email", email, 3, 15 * 60_000);
  if (!emailRl.ok) {
    return NextResponse.json(
      { error: "Too many sign-in attempts for this email. Try again later." },
      { status: 429, headers: { "Retry-After": Math.ceil(emailRl.resetMs / 1000).toString() } },
    );
  }

  if (!isAllowed(email)) {
    return NextResponse.json({ error: "This email is not allowed to sign in." }, { status: 403 });
  }

  const token = createMagicToken(email);
  const appUrl = process.env.APP_URL ?? new URL(req.url).origin;
  const link = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

  const code = generateOtp();
  await db.signInCode.deleteMany({ where: { email } });
  await db.signInCode.create({
      data: {
        email,
        codeHash: hashOtp(code, email),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

  try {
    await sendMagicLink({ to: email, url: link, code, appUrl });
  } catch (e) {
    console.error("[auth:request] email failed", e);
    return NextResponse.json({ error: "Failed to send email." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
