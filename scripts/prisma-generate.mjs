// Generates the Prisma client for the platform being built. One schema, one
// output path; only the generator's `runtime` differs: "nodejs" for Vercel
// (the "workerd" client makes Next's output tracing pull in all of
// node_modules — 700 MB — and fail the deploy) and "workerd" for Cloudflare
// (the "nodejs" client fails at runtime on Workers). Usage:
//   node scripts/prisma-generate.mjs            # nodejs
//   PRISMA_RUNTIME=workerd node scripts/prisma-generate.mjs
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";

const runtime = process.env.PRISMA_RUNTIME ?? "nodejs";
const source = "prisma/schema.prisma";
const temp = "prisma/.generated.prisma"; // same directory, so `output` resolves the same

const schema = readFileSync(source, "utf8");
const patched = schema.replace(/^(\s*runtime\s*=\s*)"[^"]+"/m, `$1"${runtime}"`);
if (patched === schema && !/^\s*runtime\s*=/m.test(schema)) {
  console.error("prisma-generate: no `runtime =` line in the generator block");
  process.exit(1);
}
writeFileSync(temp, patched);
try {
  const res = spawnSync("npx", ["prisma", "generate", "--schema", temp], { stdio: "inherit" });
  process.exitCode = res.status ?? 1;
} finally {
  unlinkSync(temp);
}
