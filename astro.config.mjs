// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  // Static output — all pages pre-rendered at build time.
  // Cloudflare Pages serves them as static files; functions/ continues to
  // handle all dynamic API routes (functions/api/[[path]].ts via Hono).
  output: "static",

  site: "https://home.remydemo.com",

  // Build to /dist (matches pages_build_output_dir in wrangler.toml)
  outDir: "./dist",

  // Don't trail-slash URLs — /waf not /waf/
  trailingSlash: "never",

  build: {
    // Use absolute paths for asset URLs so they resolve correctly when
    // pages are served from any depth.
    assets: "_astro",
  },

  vite: {
    // Pages Functions live in /functions and are NOT bundled by Astro/Vite.
    // Wrangler picks them up at deploy time and bundles them separately.
    server: {
      watch: {
        ignored: ["**/functions/**", "**/.legacy/**"],
      },
    },
  },
});
