import { agentHealth } from "@/lib/agent-status";
import { nowMs } from "@/lib/format";

// The header's one-glance answer to "is my agent alive?". The outage banner
// covers the bad case; this shows the good one, which was invisible before.
export async function AgentDot() {
  const health = await agentHealth();
  if (!health.lastSeenAt) return null;
  const ageSec = Math.round((nowMs() - health.lastSeenAt.getTime()) / 1000);
  const age = ageSec < 90 ? `${ageSec} s` : ageSec < 5400 ? `${Math.round(ageSec / 60)} min` : `${Math.round(ageSec / 3600)} h`;
  return (
    <span
      title={health.stale ? `Local agent last seen ${age} ago` : `Local agent alive · polled ${age} ago`}
      className="hidden sm:inline-flex items-center gap-1.5 text-xs text-neutral-500"
    >
      <span
        className={
          "inline-block h-2 w-2 rounded-full " +
          (health.stale ? "bg-red-500" : "bg-emerald-500")
        }
        aria-hidden
      />
      agent · {age}
    </span>
  );
}
