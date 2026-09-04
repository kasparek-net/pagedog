import { db } from "@/lib/db";
import { fetchHtml, isBotBlock } from "@/lib/extract";
import { agentHealth } from "@/lib/agent-status";

const AGENT_TIMEOUT_MS = 45_000;
const AGENT_POLL_MS = 1_000;

// Queue the page for the local agent and wait for the HTML to come back.
export async function fetchViaAgent(url: string): Promise<string> {
  const job = await db.previewJob.create({ data: { url } });
  const deadline = Date.now() + AGENT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, AGENT_POLL_MS));
    const current = await db.previewJob.findUnique({ where: { id: job.id } });
    if (!current?.doneAt) continue;
    // Each job carries a whole page; nothing needs it once it has been read.
    db.previewJob.delete({ where: { id: job.id } }).catch(() => {});
    if (current.html) return current.html;
    throw new Error(current.error ?? "Agent could not fetch the page");
  }
  throw new Error("The local agent did not answer in time");
}

// Cloud first; when the shop refuses our datacenter IP and the agent is
// alive, ask it instead. Interactive use only — checks have their own path.
export async function fetchPageAnywhere(url: string): Promise<string> {
  try {
    return await fetchHtml(url);
  } catch (e) {
    if (isBotBlock(e) && !(await agentHealth()).stale) return fetchViaAgent(url);
    throw e;
  }
}
