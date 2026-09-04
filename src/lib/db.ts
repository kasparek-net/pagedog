import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeonHTTP } from "@prisma/adapter-neon";

// Neon over plain HTTP: every query is one fetch, nothing stays open. That
// is what lets a single client be shared across requests on Cloudflare
// Workers, where a socket opened by one request cannot be used by the next
// ("Cannot perform I/O on behalf of a different request"), and it runs the
// same on Node. The trade-off is no transactions — writes that used to be
// batched are sequential, which for this app is a check row arriving a few
// milliseconds after its watch update.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({
    adapter: new PrismaNeonHTTP(connectionString, { arrayMode: false, fullResults: true }),
  });
}

// Created on first use rather than at import time: on Workers the
// environment is populated per request, and nothing should touch the
// database while a module loads.
function client(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = create();
  return globalForPrisma.prisma;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const real = client();
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
