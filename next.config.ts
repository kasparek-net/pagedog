import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma's runtime is traced as an external package; without these
  // excludes the trace drags in the CLI and every database engine, and the
  // Cloudflare bundle then ships ~10 MB of wasm this app never loads. Only
  // the Postgres query compiler generated into src/generated is used.
  serverExternalPackages: ["@prisma/client"],
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
