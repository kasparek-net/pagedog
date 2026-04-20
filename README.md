<p align="center">
  <img src="public/logo.svg" alt="Pagedog" width="320">
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org)
[![Deploy on Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/kasparek-net/pagedog)

> This is a template for your own self-hosted instance. **I don't run a public hosted version** — fork it and deploy your own (free on Vercel + Neon + Resend + Clerk).

Self-hosted website change watcher. Paste a URL, click the element you want to track, and Pagedog checks it every hour. When the text changes, you get an email. Product back-in-stock alerts, price drops, status page changes — without paying Visualping or Distill.io every month.

## Features

- 🖱 **Visual picker** — hover inside the page preview, click, and the app remembers a unique CSS selector.
- ⏰ **Hourly checks** via GitHub Actions cron (free).
- 📧 **Email notifications** via Resend (3,000 emails/month on the free tier).
- 👥 **Multi-user** — each user has their own watches and notification email (Clerk auth).
- 🔒 **Safe defaults** — sandboxed iframe picker, SSRF protection with DNS-rebind check, per-user rate limits, timing-safe cron secret.
- 💸 **Free forever** on Vercel Hobby + Neon free tier + Resend free tier + Clerk free tier.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma · Postgres · Clerk · Resend · cheerio.

## Quick start (local)

```bash
git clone https://github.com/kasparek-net/pagedog
cd pagedog
npm install
cp .env.example .env
# fill in DATABASE_URL, NEXT_PUBLIC_CLERK_*, CLERK_SECRET_KEY, RESEND_API_KEY, CRON_SECRET
npm run db:push          # creates tables in your DB
npm run dev
```

Open <http://localhost:3000>, sign up via Clerk, and create your first watch.

Trigger a check manually:

```bash
curl -X POST http://localhost:3000/api/cron/check \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Deploy to Vercel

1. Fork this repo and connect it to Vercel (or click "Deploy on Vercel" above).
2. Vercel Marketplace → add **Neon Postgres**, **Clerk**, **Resend** (env vars are wired automatically).
3. Add `CRON_SECRET` (`openssl rand -hex 32`) and `APP_URL` (e.g. `https://pagedog.vercel.app`).
4. After the first deploy: `vercel env pull && npm run db:push`.
5. GitHub repo → Settings → Secrets and variables → Actions → add `APP_URL` and `CRON_SECRET`. The `.github/workflows/cron.yml` workflow will then hit `/api/cron/check` every hour.

## How the picker works

- `/watches/new` → paste a URL → the server fetches HTML, sanitizes it (no `<script>`, `<form>`, `on*` attributes, no `<iframe>`), injects `<base href>` and `/picker.js`.
- HTML is rendered into `<iframe srcdoc>` with `sandbox="allow-scripts"` (no `allow-same-origin` = isolated from your session, no cookie access).
- Inside the iframe `picker.js` outlines elements red on hover; on click it computes a unique CSS selector and sends it to the parent via `postMessage`.

Limitation: client-rendered SPAs (React/Vue) don't hydrate inside the sandboxed iframe — the picker works on server-rendered HTML. For advanced cases you can type the selector manually.

## Cron flow

1. GitHub Actions (hourly) → `POST /api/cron/check` with a bearer token.
2. The endpoint loads all active watches and fetches them in parallel (concurrency 5) using cheerio to extract the selected element.
3. It hashes the extracted text (SHA-256). If the hash differs from `lastHash`, it creates a `Change` row and sends an email via Resend.

## Security

- `/api/preview` and `POST /api/watches` are rate-limited per user.
- The URL fetcher (`/api/preview`, watch creation) blocks private IP ranges and localhost — a DNS lookup runs before the fetch to defeat DNS rebinding.
- The iframe picker runs with `sandbox="allow-scripts"` — no access to user session.
- `CRON_SECRET` is compared timing-safely. Without it set, the endpoint returns 503.
- Per-user watch count cap (`MAX_WATCHES_PER_USER`, default 50).

Report security issues as described in [SECURITY.md](SECURITY.md).

## Contributing

PRs welcome. CI runs on every push (typecheck + build). There are no tests yet — if you add some, great.

Smaller changes: open a PR directly. Larger (refactor, new provider, different DB driver): open an issue first to discuss the approach.

## License

[MIT](LICENSE) © Jakub Kašpárek and contributors.

Use at your own risk.
