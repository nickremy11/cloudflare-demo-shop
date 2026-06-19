# Cloudflare Demo Shop

An interactive demo site showcasing the Cloudflare platform across four pillars,
26 solutions in total. Built with **Astro** (static output), deployed on
**Cloudflare Pages**, with **Pages Functions** (Hono on Workers) powering the
interactive demos.

Live: <https://remydemo.com>

> **Want to add or change something?** See **[CONTRIBUTING.md](./CONTRIBUTING.md)** —
> it has step-by-step recipes for adding solutions, interactive demos, API
> routes, pillars, etc. That file is written for both humans and AI agents.

---

## Pillars

- **SASE / Workspace Security** — Zero Trust, SWG, Browser Isolation, CASB, Email Security
- **App Security & Performance** — WAF, Bot Management & Rate Limiting, API Security, Client-Side Security, L7 DDoS, Turnstile, CDN & Caching, Argo Smart Routing, Load Balancing, Image Optimization, DNS
- **Developer Platform** — Workers, Workers AI, Cloud Storage (D1/R2/KV), AI Gateway, Pages, Durable Objects
- **Network Security** — Magic Transit, Cloudflare WAN, Magic Firewall, Spectrum

---

## Project structure

```
cloudflare-demo-shop/
├── astro.config.mjs              # Astro config (static output)
├── tsconfig.json
├── package.json
├── wrangler.toml                 # Cloudflare Pages config
├── README.md                     # this file
├── CONTRIBUTING.md               # ← how to add solutions, demos, etc.
│
├── src/
│   ├── layouts/
│   │   ├── Base.astro            # HTML shell, header, footer, chat widget
│   │   └── SolutionPage.astro   # The 6-section solution template
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── ChatWidget.astro
│   │   ├── SolutionCard.astro
│   │   ├── PillarSection.astro
│   │   ├── DiagramSlot.astro
│   │   ├── FAQList.astro
│   │   ├── DiveDeeper.astro
│   │   ├── DemoSlot.astro       # Routes to the right interactive demo
│   │   └── demos/               # One Astro component per interactive demo
│   ├── content/
│   │   ├── config.ts            # Content collection schema (Zod)
│   │   └── solutions/           # One .md file per solution (26 total)
│   ├── pages/
│   │   ├── index.astro          # Homepage with 4 pillar sections
│   │   ├── [slug].astro         # Dynamic route → all 26 solution pages
│   │   └── diagrams/index.astro # Diagrams browser
│   ├── data/
│   │   └── pillars.ts           # Pillar definitions / ordering
│   └── styles/
│       └── global.css
│
├── public/
│   ├── diagrams/                # PNG diagrams
│   └── styles/main.css          # Legacy CSS kept for back-compat
│
└── functions/                    # Cloudflare Pages Functions
    ├── _middleware.js            # Injects _cfbm cookie with bot score
    └── api/[[path]].ts          # Single Hono app, all API routes
```

---

## Local development

```bash
# One-time install
npm install

# Astro dev server — fast HMR, frontend only, no Workers bindings
npm run dev          # http://localhost:4321

# Full local stack — Pages Functions included (needs wrangler login)
npm run dev:full     # http://localhost:8788

# One-shot static build
npm run build        # → dist/

# Build + deploy
npm run deploy
```

Use `npm run dev` for iterating on layouts, content, and demo UI — it's much
faster. Use `npm run dev:full` when you're testing API endpoints, R2 uploads,
or anything that requires the real Pages Functions runtime.

---

## Deployment

Connected to Cloudflare Pages via GitHub. Push to `main` triggers an automatic
build (`npm run build`) and deploys `dist/`.

### Environment variables / secrets

Set in the Cloudflare Pages dashboard (Settings → Environment variables) or via
`wrangler pages secret put`:

| Name | Type | Used by |
|---|---|---|
| `AIG_TOKEN` | secret | Chatbot, Workers AI demo, AI Gateway demo |
| `CF_ZONE_ID` | plain | CDN cache purge demo |
| `CF_CACHE_PURGE_TOKEN` | secret | CDN cache purge demo (API token with Zone:Cache Purge) |
| `TURNSTILE_SECRET` | secret | Turnstile demo (optional — falls back to CF's test secret) |

R2 buckets and KV namespaces are bound in `wrangler.toml`.

---

## How the Astro rebuild differs from the previous version

The old site was one big `index.html` plus per-demo HTML files (~300 lines of
duplicated boilerplate each). Two demos were built (WAF, R2); the rest were
stub links to nonexistent pages.

The Astro rebuild replaces this with:

- **One layout** (`SolutionPage.astro`) covering all 26 solution pages
- **One content schema** driving all of them via `.md` files
- **One dynamic route** (`[slug].astro`) generating them all at build
- **One DemoSlot component** that switches between coming-soon / external-link
  / interactive based on frontmatter

Adding a new solution: write a markdown file. Adding interactivity: drop in a
new `.astro` component and register it. No more copy-paste-edit.

The `functions/` directory is unchanged in architecture — same Hono app
handling all `/api/*` routes. New endpoints added: `/api/cache/purge`,
`/api/turnstile/verify`, `/api/waf/testattack` (replaces `/api/waf-test`, alias
kept for back-compat).

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the actual how-to.
