#!/bin/sh
# Keeps the agent current without anyone touching the machine it runs on:
# fetch the latest agent from the repository, run it, and start over when it
# exits — which it does when the server announces a newer version, and once a
# day regardless. Meant to run inside the node:22-slim container, see README.
BASE="https://raw.githubusercontent.com/kasparek-net/pagedog/main/agent"
cd /app || exit 1

getfile() {
  node -e "
    fetch('$BASE/$1?' + Date.now())
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then((t) => require('fs').writeFileSync('$1', t))
      .catch((e) => { console.error('fetch $1 failed:', e.message); process.exit(1); });
  "
}

while true; do
  if getfile agent.js && getfile package.json; then
    if ! cmp -s package.json .installed.json; then
      npm install --omit=dev --no-audit --no-fund && cp package.json .installed.json
    fi
  else
    echo "could not fetch the agent, running what is already here"
  fi
  timeout 86400 node agent.js || true
  sleep 10
done
