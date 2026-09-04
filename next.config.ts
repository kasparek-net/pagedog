import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Without these excludes the output trace drags in the Prisma CLI and
  // every database engine, and the Cloudflare bundle then ships ~10 MB of
  // wasm this app never loads. Only the Postgres query compiler generated
  // into src/generated is used. (Marking @prisma/client as an external
  // package made Vercel trace all of node_modules — 700 MB — so it is not.)
  outputFileTracingExcludes: {
    "*": [
      "./node_modules/prisma/**",
      "./node_modules/@prisma/engines/**",
      "./node_modules/@prisma/client/**/*.wasm",
      "./node_modules/@prisma/client/runtime/wasm-engine-edge*",
      "./node_modules/@prisma/client/runtime/library*",
      "./node_modules/@prisma/client/runtime/binary*",
      "./node_modules/.prisma/**",
    ],
  },
};

export default nextConfig;
