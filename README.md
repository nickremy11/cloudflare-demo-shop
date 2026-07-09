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
├── chat-worker/                  # Standalone Worker hosting the ChatRoom DO
│   ├── wrangler.toml
│   └── src/index.ts
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
# If the chat-worker has changed, deploy it first so the CHAT_ROOM binding
# resolves locally as well as in production.
npx wrangler deploy --config chat-worker/wrangler.toml
npm run dev:full     # http://localhost:8788

# One-shot static build
npm run build        # → dist/

# Pages deploy
npm run deploy
```

Use `npm run dev` for iterating on layouts, content, and demo UI — it's much
faster. Use `npm run dev:full` when you're testing API endpoints, R2 uploads,
or anything that requires the real Pages Functions runtime.

---

## Deployment

Connected to Cloudflare Pages via GitHub. Push to `main` triggers an automatic
build (`npm run build`) and deploys `dist/`.

### Durable Objects deploy order

The `/durable-objects` demo is backed by a **standalone Worker** named
`demo-shop-chat`, which hosts the `ChatRoom` Durable Object class. The Pages
project binds to that class via `script_name = "demo-shop-chat"` in
`wrangler.toml`.

If you change `chat-worker/src/index.ts`, you must deploy the chat worker
**before** deploying Pages:

```bash
# 1. Deploy the Worker that owns the ChatRoom DO class
npx wrangler deploy --config chat-worker/wrangler.toml

# 2. Then deploy Pages as normal
npm run deploy
```

Normal content / Astro / Pages Function changes still deploy through the usual
GitHub → Pages flow. Only DO class changes require the extra Worker deploy.

### Environment variables / secrets

Set in the Cloudflare Pages dashboard (Settings → Environment variables) or via
`wrangler pages secret put`:

| Name | Type | Used by |
|---|---|---|
| `AIG_TOKEN` | secret | Chatbot, Workers AI demo, AI Gateway demo |
| `ABOUTME_AI_SEARCH_INSTANCE` | plain | About Me AutoRAG / AI Search demo instance name |
| `CF_ZONE_ID` | plain | CDN cache purge demo |
| `CF_CACHE_PURGE_TOKEN` | secret | CDN cache purge demo (API token with Zone:Cache Purge) |
| `TURNSTILE_SECRET` | secret | Turnstile demo (optional — falls back to CF's test secret) |

Other runtime bindings configured in `wrangler.toml`:

| Name | Type | Used by |
|---|---|---|
| `STORAGE_BUCKET` | R2 bucket | R2 upload / download demo |
| `DIAGRAMS_BUCKET` | R2 bucket | Diagram browser |
| `DEMO_KV` | KV namespace | R2 metadata, Page Shield scenarios |
| `AI` | Workers AI binding | Chatbot, Workers AI demo, chat PG moderation |
| `AI_SEARCH` | AI Search namespace binding | About Me AutoRAG / AI Search demo |
| `CHAT_ROOM` | DO binding (`script_name = demo-shop-chat`) | Durable Objects chat room demo |

---

## About Me AutoRAG demo

The `/aboutme` page is synthetic private source data for demonstrating that an
LLM cannot answer specific questions unless the app retrieves the page through
RAG. The page is public at <https://remydemo.com/aboutme> so it is easy to
render and ingest, but it is marked `noindex,nofollow,noarchive` in both HTML
metadata and `public/_headers`.

Recommended setup:

1. Build and deploy the site so `/aboutme` is available.
2. Create an R2 bucket named `remydemo-autorag-source`.
3. Upload the rendered page as the source document:

```bash
npm run build
npx wrangler r2 bucket create remydemo-autorag-source
npx wrangler r2 object put remydemo-autorag-source/remydemo/aboutme.html --file dist/aboutme/index.html
```

4. In the Cloudflare dashboard, go to **AI > AutoRAG / AI Search** and create an instance named `remydemo-aboutme-rag`.
5. Select the `remydemo-autorag-source` R2 bucket as the data source.
6. Use the default embedding and generation models unless the demo needs a specific model comparison.
7. Select the existing AI Gateway named `demo-shop-gateway` so model usage and generated responses are observable.
8. Wait for indexing to complete. AutoRAG / AI Search provisions and uses Vectorize for the embeddings behind the scenes.
9. Test in the dashboard playground with: `What is Remy Calder's internal codename?`
10. Test from the Pages Function endpoint:

```bash
curl -X POST https://remydemo.com/api/aboutme-rag \
  -H "Content-Type: application/json" \
  -d '{"query":"What is Remy Calder internal codename?"}'
```

The demo path is: `/aboutme` source content → R2 object → AutoRAG / AI Search
indexing → Vectorize embeddings → `/api/aboutme-rag` Pages Function → generated
answer, with model calls observable in AI Gateway.

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

The `functions/` directory is still one Hono app handling all `/api/*` routes,
but the Durable Objects demo adds a second script to the repo:

- **Pages Functions** (`functions/api/[[path]].ts`) own the HTTP routes,
  validation, and UI-facing API shape.
- **`chat-worker/`** owns the `ChatRoom` Durable Object class, SQLite storage,
  WebSocket fan-out, and the daily 17:00 UTC reset alarm.

The Pages app talks to the DO through the `CHAT_ROOM` binding. This keeps the
site on Pages while still using a real standalone Durable Object Worker.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the actual how-to.
