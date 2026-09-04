import { db } from "@/lib/db";

// The agent lives on a single home machine that can (and did) go down without
// a trace. Watches on hosts it owns would then simply stop being checked, so
// its last poll is recorded and anything older than this counts as gone.
export const AGENT_STALE_MS = 10 * 60_000;

const ROW_ID = "agent";

export async function touchAgent(): Promise<void> {
  const now = new Date();
  await db.agentStatus.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, lastSeenAt: now },
    update: { lastSeenAt: now, staleNotifiedAt: null },
  });
}

export type AgentHealth = {
  lastSeenAt: Date | null;
  stale: boolean;
  staleNotifiedAt: Date | null;
};

export async function agentHealth(): Promise<AgentHealth> {
  const row = await db.agentStatus.findUnique({ where: { id: ROW_ID } });
  if (!row) return { lastSeenAt: null, stale: true, staleNotifiedAt: null };
  return {
    lastSeenAt: row.lastSeenAt,
    stale: Date.now() - row.lastSeenAt.getTime() > AGENT_STALE_MS,
    staleNotifiedAt: row.staleNotifiedAt,
  };
}

export async function markAgentStaleNotified(): Promise<void> {
  await db.agentStatus.update({
    where: { id: ROW_ID },
    data: { staleNotifiedAt: new Date() },
  });
}
