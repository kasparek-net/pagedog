import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page is rendered per request (force-dynamic), so no incremental cache
// is configured; add the R2 override here if static generation is ever used.
export default defineCloudflareConfig({});
