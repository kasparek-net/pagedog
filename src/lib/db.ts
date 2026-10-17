import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@/generated/prisma/client";

// Cloudflare D1 through the worker's `DB` binding. Locally `next dev` gets a
// Miniflare-backed binding from initOpenNextCloudflareForDev (next.config.ts),
// stored under .wrangler/state; `npm run db:migrate:local` creates its tables.
type D1Binding = ConstructorParameters<typeof PrismaD1>[0];

let cached: { binding: D1Binding; client: PrismaClient } | undefined;

// Resolved on first use rather than at import time: the binding only exists
// inside a request, and nothing should touch the database while a module loads.
function client(): PrismaClient {
  const binding = (getCloudflareContext().env as { DB?: D1Binding }).DB;
  if (!binding) throw new Error("D1 binding DB is not configured");
  if (cached?.binding !== binding) {
    cached = { binding, client: new PrismaClient({ adapter: new PrismaD1(binding) }) };
  }
  return cached!.client;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const real = client();
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
