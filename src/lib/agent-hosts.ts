// Hosts that block our datacenter IP and are therefore checked by the local
// agent (see the pagedog-agent project) instead of the Vercel cron.
export function agentHosts(): string[] {
  return (process.env.AGENT_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function isAgentHost(url: string): boolean {
  const hosts = agentHosts();
  if (hosts.length === 0) return false;
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}
