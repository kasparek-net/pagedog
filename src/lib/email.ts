import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM ?? "Pagedog <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

export async function sendMagicLink(input: {
  to: string;
  url: string;
  code: string;
  appUrl: string;
}) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set, magic link:", input.url, "code:", input.code);
    return;
  }
  let host: string;
  try {
    host = new URL(input.appUrl).host;
  } catch {
    host = "pagedog";
  }
  const subject = `🔑 Pagedog sign-in code: ${input.code}`;
  const html = `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0a0a0a;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="margin:0 0 8px">🔑 Sign in to Pagedog</h2>
  <p style="margin:0 0 16px;color:#525252">Your verification code is:</p>
  <p style="margin:16px 0;font-size:32px;font-weight:600;letter-spacing:4px;text-align:center;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">${escape(input.code)}</p>
  <p style="margin:0 0 24px;color:#737373;font-size:13px;text-align:center">This code expires in 15 minutes.</p>
  <p style="margin:24px 0 8px;color:#525252">Or click the button to sign in directly:</p>
  <p style="margin:8px 0 24px">
    <a href="${escape(input.url)}" style="display:inline-block;background:#eabf43;color:#0a0a0a;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:500">Sign in</a>
  </p>
  <p style="margin:0;color:#a3a3a3;font-size:12px">If you didn&apos;t request this, you can ignore the email.</p>
  <p style="margin:24px 0 0;color:#d4d4d4;font-size:11px">@${escape(host)} #${escape(input.code)}</p>
</body></html>`;
  const text = `Your Pagedog verification code is: ${input.code}\n\nThis code expires in 15 minutes.\n\nOr sign in directly: ${input.url}\n\n@${host} #${input.code}`;
  await resend.emails.send({ from, to: input.to, subject, html, text });
}

export async function sendChangeNotification(input: {
  to: string;
  label: string;
  url: string;
  oldValue: string;
  newValue: string;
  watchId: string;
}) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set, skipping send");
    return;
  }
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const subject = `🔔 Change detected: ${input.label}`;
  const html = `
<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0a0a0a;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="margin:0 0 8px">🔔 ${escape(input.label)}</h2>
  <p style="margin:0 0 16px;color:#525252">A change was detected on the watched page.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;background:#fafafa;border:1px solid #e5e5e5;width:80px;font-size:12px;color:#737373">Was</td><td style="padding:8px;border:1px solid #e5e5e5">${escape(input.oldValue)}</td></tr>
    <tr><td style="padding:8px;background:#fafafa;border:1px solid #e5e5e5;font-size:12px;color:#737373">Now</td><td style="padding:8px;border:1px solid #e5e5e5"><strong>${escape(input.newValue)}</strong></td></tr>
  </table>
  <p style="margin:24px 0 8px"><a href="${escape(input.url)}" style="display:inline-block;background:#eabf43;color:#0a0a0a;padding:8px 14px;border-radius:6px;text-decoration:none;font-weight:500">Open page</a></p>
  <p style="margin:16px 0 0"><a href="${escape(appUrl)}/watches/${input.watchId}" style="color:#737373;font-size:12px">View in Pagedog →</a></p>
</body></html>`;
  const text = `Change detected: ${input.label}\n\nWas: ${input.oldValue}\nNow: ${input.newValue}\n\nPage: ${input.url}\nDetails: ${appUrl}/watches/${input.watchId}\n`;
  await resend.emails.send({
    from,
    to: input.to,
    subject,
    html,
    text,
  });
}

export async function sendSelectorGoneNotification(input: {
  to: string;
  label: string;
  url: string;
  selector: string;
  lastValue: string;
  watchId: string;
}) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set, skipping selector-gone email");
    return;
  }
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const subject = `⚠️ Page changed: ${input.label}`;
  const html = `
<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0a0a0a;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="margin:0 0 8px">⚠️ ${escape(input.label)}</h2>
  <p style="margin:0 0 16px;color:#525252">The element we were tracking is no longer on the page — it looks like the page was redesigned or the content was removed. The watch has been paused.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;background:#fafafa;border:1px solid #e5e5e5;width:80px;font-size:12px;color:#737373">Last seen</td><td style="padding:8px;border:1px solid #e5e5e5">${escape(input.lastValue)}</td></tr>
    <tr><td style="padding:8px;background:#fafafa;border:1px solid #e5e5e5;font-size:12px;color:#737373">Selector</td><td style="padding:8px;border:1px solid #e5e5e5;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px">${escape(input.selector)}</td></tr>
  </table>
  <p style="margin:24px 0 8px"><a href="${escape(appUrl)}/watches/${input.watchId}" style="display:inline-block;background:#eabf43;color:#0a0a0a;padding:8px 14px;border-radius:6px;text-decoration:none;font-weight:500">Update selector</a></p>
  <p style="margin:8px 0 0;color:#a3a3a3;font-size:12px">Page: <a href="${escape(input.url)}" style="color:#737373">${escape(input.url)}</a></p>
</body></html>`;
  const text = `Page changed: ${input.label}\n\nThe element we were tracking is no longer on the page — it looks like the page was redesigned or the content was removed. The watch has been paused.\n\nLast seen: ${input.lastValue}\nSelector: ${input.selector}\n\nUpdate selector: ${appUrl}/watches/${input.watchId}\nPage: ${input.url}\n`;
  await resend.emails.send({ from, to: input.to, subject, html, text });
}

export async function sendAutoPauseNotification(input: {
  to: string;
  label: string;
  url: string;
  lastError: string;
  failures: number;
  watchId: string;
}) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set, skipping auto-pause email");
    return;
  }
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const subject = `⏸️ Watch paused: ${input.label}`;
  const html = `
<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0a0a0a;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="margin:0 0 8px">⏸️ ${escape(input.label)}</h2>
  <p style="margin:0 0 16px;color:#525252">This watch failed ${input.failures} times in a row and has been paused.</p>
  <p style="margin:0 0 8px;color:#737373;font-size:13px">Last error</p>
  <pre style="margin:0 0 16px;padding:12px;background:#fafafa;border:1px solid #e5e5e5;border-radius:6px;white-space:pre-wrap;font-size:12px">${escape(input.lastError)}</pre>
  <p style="margin:16px 0"><a href="${escape(appUrl)}/watches/${input.watchId}" style="display:inline-block;background:#eabf43;color:#0a0a0a;padding:8px 14px;border-radius:6px;text-decoration:none;font-weight:500">Fix and resume</a></p>
  <p style="margin:8px 0 0;color:#a3a3a3;font-size:12px">Page: <a href="${escape(input.url)}" style="color:#737373">${escape(input.url)}</a></p>
</body></html>`;
  const text = `Watch paused: ${input.label}\n\nThis watch failed ${input.failures} times in a row and has been paused.\n\nLast error:\n${input.lastError}\n\nFix and resume: ${appUrl}/watches/${input.watchId}\nPage: ${input.url}\n`;
  await resend.emails.send({ from, to: input.to, subject, html, text });
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
