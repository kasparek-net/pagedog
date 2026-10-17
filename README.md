<p align="center">
  <img src="public/logo.svg" alt="Pagedog" width="320">
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org)

> This is a template for your own self-hosted instance. **I don't run a public hosted version** — fork it and deploy your own (Cloudflare Workers + D1 + Resend).

Self-hosted website change watcher. Paste a URL, click the element you want to track, and Pagedog checks it every hour. When the text changes, you get an email. Product back-in-stock alerts, price drops, status page changes — without paying Visualping or Distill.io every month.

<p align="center">
  <img src="public/screenshots/watches-list.png" alt="Pagedog watches list" width="900">
  <br><br>
  <img src="public/screenshots/watch-detail.png" alt="Pagedog watch detail with preview" width="900">
</p>

## Features

- 🖱 **Visual picker** — hover inside the page preview, click, and the app remembers a unique CSS selector.
- ⏰ **Scheduled checks** via a Cloudflare cron trigger.
- 📧 **Email notifications** via Resend (3,000 emails/month on the free tier).
- 👥 **Multi-user** — each user has their own watches and notification email. Sign-in is a passwordless magic link (no passwords to store); access is gated by an `ALLOWED_EMAILS` allowlist so only you (or whoever you invite) can sign up.
- 🔒 **Safe defaults** — sandboxed iframe picker, SSRF protection with DNS-rebind check, per-user rate limits, timing-safe cron secret, HMAC-signed session cookies.
- 💸 **Cheap to run** on Cloudflare Workers + D1 + the Resend free tier.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma · Cloudflare D1 (SQLite) · Resend · cheerio. Auth is a small in-house magic-link flow (HMAC-signed tokens, no third-party dependency).

## Quick start (local)

```bash
git clone https://github.com/kasparek-net/pagedog
cd pagedog
npm install
cp .env.example .env
# fill in AUTH_SECRET, ALLOWED_EMAILS, RESEND_API_KEY, CRON_SECRET
npm run db:migrate:local # creates tables in the local D1 (.wrangler/state)
npm run dev
```

Open <http://localhost:3000>, enter an email from `ALLOWED_EMAILS`, and click the magic link you receive to sign in.

Trigger a check manually:

```bash
curl -X POST http://localhost:3000/api/cron/check \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Deploy to Cloudflare

1. Fork this repo. `npx wrangler d1 create pagedog` and put the returned `database_id` into `wrangler.jsonc`.
2. `npm run db:migrate:remote` creates the tables.
3. Set the secrets with `npx wrangler secret put NAME`:
   - `AUTH_SECRET` (`openssl rand -hex 32`) — HMAC key for magic links and sessions
   - `ALLOWED_EMAILS` — comma-separated list of emails allowed to sign in
   - `CRON_SECRET` (`openssl rand -hex 32`) — bearer token for `/api/cron/check`
   - `APP_URL` (e.g. `https://pagedog.example.com`) — used in emailed links
   - `RESEND_API_KEY`, `RESEND_FROM` — e.g. `Pagedog <noreply@yourdomain.tld>`
4. `npm run cf:deploy`, or connect the repo in Workers Builds (build `npm run cf:build`, deploy `npx wrangler deploy`). The cron trigger in `wrangler.jsonc` hits `/api/cron/check` every 5 minutes.

## Auth flow

- Visit `/sign-in`, enter your email → `POST /api/auth/request` checks `ALLOWED_EMAILS`, mints a HMAC-signed magic token (15 min TTL), and emails the link via Resend.
- The link goes to `GET /api/auth/verify?token=…`, which verifies the HMAC and sets a signed session cookie (`pd_session`) valid for one year with rolling renewal.
- No passwords are stored. No third-party auth SDK. If `AUTH_SECRET` is rotated, all existing sessions are invalidated.

## How the picker works

- `/watches/new` → paste a URL → the server fetches HTML, sanitizes it (no `<script>`, `<form>`, `on*` attributes, no `<iframe>`), injects `<base href>` and `/picker.js`.
- HTML is rendered into `<iframe srcdoc>` with `sandbox="allow-scripts"` (no `allow-same-origin` = isolated from your session, no cookie access).
- Inside the iframe `picker.js` outlines elements red on hover; on click it computes a unique CSS selector and sends it to the parent via `postMessage`.

Limitation: client-rendered SPAs (React/Vue) don't hydrate inside the sandboxed iframe — the picker works on server-rendered HTML. For advanced cases you can type the selector manually.

## Cron flow

1. The Cloudflare cron trigger (`worker.ts`) → `POST /api/cron/check` with a bearer token.
2. The endpoint loads all active watches and fetches them in parallel (concurrency 5) using cheerio to extract the selected element.
3. It hashes the extracted text (SHA-256). If the hash differs from `lastHash`, it creates a `Change` row and sends an email via Resend.

## Security

- Sign-in is gated by `ALLOWED_EMAILS` — emails not on the list are rejected at `/api/auth/request` (403). Keep this list short.
- Magic-link tokens are HMAC-signed (`AUTH_SECRET`), scoped to an email, and expire after 15 minutes. Session cookies use the same HMAC, `httpOnly` + `SameSite=Lax`, and are rotated when they near expiry.
- `/api/preview` and `POST /api/watches` are rate-limited per user; `/api/auth/request` is rate-limited per IP.
- The URL fetcher (`/api/preview`, watch creation, cron) blocks private IP ranges and localhost — a DNS lookup runs before the fetch to defeat DNS rebinding.
- The iframe picker runs with `sandbox="allow-scripts"` (no `allow-same-origin`) — no access to user session.
- `CRON_SECRET` is compared timing-safely. Without it set, the endpoint returns 503.
- Per-user watch count cap (`MAX_WATCHES_PER_USER`, default 50).

Report security issues as described in [SECURITY.md](SECURITY.md).

## Contributing

PRs welcome. CI runs on every push (typecheck + build). There are no tests yet — if you add some, great.

Smaller changes: open a PR directly. Larger (refactor, new provider, different DB driver): open an issue first to discuss the approach.

## License

[MIT](LICENSE) © Jakub Kašpárek and contributors.

Use at your own risk.
