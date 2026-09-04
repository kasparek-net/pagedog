import type { NextConfig } from "next";

// The Cloudflare build (PRISMA_RUNTIME=workerd, see scripts/prisma-generate.mjs)
// bundles everything the output trace lists, and without these excludes the
// trace drags in the Prisma CLI and the engines for every database — ~10 MB
// of wasm this app never loads. Vercel packages functions from the same
// trace but needs Prisma's own files in place, so it gets no excludes.
const forWorkers = process.env.PRISMA_RUNTIME === "workerd";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: forWorkers
    ? {
        "*": [
          "./node_modules/prisma/**",
          "./node_modules/@prisma/engines/**",
          "./node_modules/@prisma/client/**/*.wasm",
          "./node_modules/@prisma/client/runtime/wasm-engine-edge*",
          "./node_modules/@prisma/client/runtime/library*",
          "./node_modules/@prisma/client/runtime/binary*",
          "./node_modules/.prisma/**",
        ],
      }
    : {},
  // Vercel: Next keeps @prisma/client external by default and then loads the
  // Postgres query compiler through a dynamic import its output trace does
  // not follow, so the function shipped without it and every query failed.
  // Bundling the package instead lets Turbopack carry that import itself.
  // The Workers build keeps it external: OpenNext bundles from the trace.
  transpilePackages: forWorkers ? [] : ["@prisma/client"],
};

export default nextConfig;
