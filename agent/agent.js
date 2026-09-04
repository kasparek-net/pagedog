// Pagedog agent. Runs on a machine at home and does the fetching Pagedog's
// cloud side cannot: it has a residential IP and a Chrome TLS fingerprint,
// so shops behind bot protection answer it. It asks the server what is due,
// fetches it, and posts the HTML back; extraction and notifications stay on
// the server. Configure via env: PAGEDOG_URL, AGENT_TOKEN.

import { Impit } from "impit";

// Bumped together with AGENT_VERSION on the server; a mismatch makes the
// agent exit so the wrapper script fetches the current file.
const VERSION = 2;

const BASE = (process.env.PAGEDOG_URL ?? "https://www.pagedog.xyz").replace(/\/$/, "");
const TOKEN = process.env.AGENT_TOKEN;
const TIMEOUT_MS = 30_000;
const MAX_BYTES = 5 * 1024 * 1024;
// The server says how soon to come back: quickly while somebody is waiting on
// a preview, otherwise at a relaxed pace.
const DEFAULT_POLL_MS = 15_000;

if (!TOKEN) {
  console.error("AGENT_TOKEN is not set");
  process.exit(1);
}

const auth = { Authorization: `Bearer ${TOKEN}` };
const impit = new Impit({ browser: "chrome", timeout: TIMEOUT_MS });

async function fetchPage(url) {
  const res = await impit.fetch(url, {
    headers: { "Accept-Language": "cs,en;q=0.9" },
    timeout: TIMEOUT_MS,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status}`);
  }
  const html = await res.text();
  if (Buffer.byteLength(html) > MAX_BYTES) {
    throw new Error("Response too large (limit 5 MB)");
  }
  return html;
}

async function post(path, payload) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`${path} failed: HTTP ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function runWatch(w) {
  const t0 = Date.now();
  try {
    const html = await fetchPage(w.url);
    const out = await post("/api/agent/report", {
      watchId: w.id,
      html,
      durationMs: Date.now() - t0,
    });
    console.log(`watch ${w.url} -> ${out.result}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`watch ${w.url} -> ${message}`);
    try {
      await post("/api/agent/report", {
        watchId: w.id,
        error: message,
        durationMs: Date.now() - t0,
      });
    } catch (reportError) {
      console.error(`  reporting that failed too: ${reportError}`);
    }
  }
}

async function runPreviewJob(job) {
  try {
    const html = await fetchPage(job.url);
    await post("/api/agent/preview", { jobId: job.id, html });
    console.log(`preview ${job.url} -> ${html.length} bytes`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`preview ${job.url} -> ${message}`);
    try {
      await post("/api/agent/preview", { jobId: job.id, error: message });
    } catch (reportError) {
      console.error(`  reporting that failed too: ${reportError}`);
    }
  }
}

async function tick() {
  const res = await fetch(`${BASE}/api/agent/due`, { headers: auth });
  if (!res.ok) {
    throw new Error(`due failed: HTTP ${res.status} ${await res.text()}`);
  }
  const { watches = [], previewJobs = [], pollMs, agentVersion } = await res.json();
  if (typeof agentVersion === "number" && agentVersion !== VERSION) {
    console.log(`server wants agent v${agentVersion}, this is v${VERSION} — restarting to update`);
    process.exit(0);
  }
  for (const job of previewJobs) await runPreviewJob(job);
  for (const w of watches) await runWatch(w);
  return typeof pollMs === "number" && pollMs >= 1000 ? pollMs : DEFAULT_POLL_MS;
}

async function loop() {
  console.log(`pagedog agent v${VERSION} -> ${BASE}`);
  for (;;) {
    let wait = DEFAULT_POLL_MS;
    try {
      wait = await tick();
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, wait));
  }
}

loop();
