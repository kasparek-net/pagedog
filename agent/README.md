# pagedog-agent

Runs at home and fetches pages for Pagedog. Shops behind Cloudflare bot
management refuse datacenter IPs whatever the request looks like, but answer a
home connection with a browser TLS fingerprint. While the agent is alive it
checks every watch; the cloud cron only steps in when it goes quiet.

The agent supplies HTML only. Extraction, change detection and notifications
happen on the server.

## Run it (Docker, once)

Any 64-bit Linux box with Docker will do — a Raspberry Pi 4 is plenty.

    mkdir -p ~/pagedog-agent
    printf 'PAGEDOG_URL=https://www.pagedog.xyz\nAGENT_TOKEN=<same value as on Vercel>\n' > ~/pagedog-agent/.env

    docker run -d --name pagedog-agent --restart unless-stopped \
      --log-opt max-size=10m --log-opt max-file=3 \
      -v ~/pagedog-agent:/app -w /app --env-file ~/pagedog-agent/.env \
      node:22-slim sh -c 'node -e "fetch(\"https://raw.githubusercontent.com/kasparek-net/pagedog/main/agent/run.sh\").then(r=>r.text()).then(t=>require(\"fs\").writeFileSync(\"run.sh\",t))" && sh run.sh'

That is the last manual step. `run.sh` downloads `agent.js` from this
repository, installs `impit` (native, so it must be installed inside the
container), and restarts the agent whenever the server reports a newer
`AGENT_VERSION` — or once a day. Deploying a new agent is a push to `main`
plus bumping `VERSION` here and `AGENT_VERSION` in `src/lib/agent-version.ts`.

Logs: `docker logs -f pagedog-agent`

## Server side

- `AGENT_TOKEN` on Vercel — the same value as in `.env`
- The dashboard shows a banner and sends one email when the agent has not
  polled for ten minutes.
