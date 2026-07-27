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
├── aboutme-rag-worker/           # Standalone Worker with AI Search binding
│   ├── wrangler.toml
│   └── src/index.ts
├── docs-sync-worker/             # Standalone Worker: weekly Cloudflare-docs
│   │                             # accuracy sync (cron + AI + email, all
│   │                             # native — see "Keeping content in sync
│   │                             # with Cloudflare docs" below)
│   ├── wrangler.toml
│   └── src/
│       ├── index.ts              # scheduled()/fetch() handlers, orchestration
│       ├── schema.ts             # Zod + JSON schema for the model's output
│       ├── yaml-surgery.ts       # Surgical frontmatter edits (minimal diffs)
│       └── github.ts             # api.github.com client (read + atomic commit)
├── content-sources.json          # Per-solution doc URLs + blog tags — the
│                                 # source of truth docs-sync-worker reads
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
npm run deploy:aboutme-rag
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

### Standalone Worker deploy order

The `/durable-objects` demo is backed by a **standalone Worker** named
`demo-shop-chat`, which hosts the `ChatRoom` Durable Object class. The Pages
project binds to that class via `script_name = "demo-shop-chat"` in
`wrangler.toml`.

The `/aboutme` RAG demo is also backed by a **standalone Worker** named
`demo-shop-aboutme-rag`. That Worker owns the `AI_SEARCH` binding because Pages
Functions do not currently expose AI Search bindings directly. The Pages project
calls it through the `ABOUTME_RAG` service binding.

If either standalone Worker changes, deploy it **before** deploying Pages:

```bash
# 1. Deploy the Worker that owns the ChatRoom DO class
npx wrangler deploy --config chat-worker/wrangler.toml

# 2. Deploy the Worker that owns the AI Search binding
npm run deploy:aboutme-rag

# 3. Then deploy Pages as normal
npm run deploy
```

Normal content / Astro / Pages Function changes still deploy through the usual
GitHub → Pages flow. Changes to `chat-worker/` or `aboutme-rag-worker/` require
the extra Worker deploy first.

`docs-sync-worker/` (see "Keeping content in sync with Cloudflare docs" below)
is **not** part of this chain — the Pages project has no binding to it and
never calls it. It's deployed independently with `npm run deploy:docs-sync`
and runs entirely on its own Cron Trigger; it just happens to be the thing
that pushes commits the Pages project later builds from.

### Environment variables / secrets

Set in the Cloudflare Pages dashboard (Settings → Environment variables) or via
`wrangler pages secret put`:

| Name | Type | Used by |
|---|---|---|
| `AIG_TOKEN` | secret | Chatbot, Workers AI demo, AI Gateway demo |
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
| `ABOUTME_RAG` | Service binding | Calls the standalone About Me RAG Worker |
| `CHAT_ROOM` | DO binding (`script_name = demo-shop-chat`) | Durable Objects chat room demo |

Standalone Worker bindings:

| Name | Type | Used by |
|---|---|---|
| `ABOUTME_AI_SEARCH_INSTANCE` | plain | About Me AutoRAG / AI Search demo instance name |
| `AI_SEARCH` | AI Search namespace binding | `aboutme-rag-worker` querying `remydemo-aboutme-rag` |

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
10. Deploy the standalone RAG Worker, then deploy Pages so the `ABOUTME_RAG` service binding points at an existing Worker:

```bash
npm run deploy:aboutme-rag
npm run deploy
```

11. Test from the Pages Function endpoint:

```bash
curl -X POST https://remydemo.com/api/aboutme-rag \
  -H "Content-Type: application/json" \
  -d '{"query":"What is Remy Calder internal codename?"}'
```

The demo path is: `/aboutme` source content → R2 object → AutoRAG / AI Search
indexing → Vectorize embeddings → `/api/aboutme-rag` Pages Function →
`ABOUTME_RAG` service binding → standalone Worker with `AI_SEARCH` binding →
generated answer, with model calls observable in AI Gateway.

---

## Keeping content in sync with Cloudflare docs

`docs-sync-worker/` is a standalone Cloudflare Worker (deployed as
`demo-shop-docs-sync`) that checks every solution page against live
`developers.cloudflare.com` documentation every **Monday 08:00 UTC**, via a
Cron Trigger. It's built to be as Cloudflare-native as possible: scheduling,
doc/blog fetching, AI generation, and email notification all run as a Worker,
not a CI job. The only thing outside Cloudflare is the GitHub repo itself —
reached over plain `fetch()` calls to `api.github.com`, no GitHub Actions
involved at all.

An earlier version of this ran as a GitHub Actions workflow. It was replaced
because a Worker can do almost everything that version needed natively:

| Piece | GitHub Actions version | This Worker |
|---|---|---|
| Scheduling | `schedule: cron` | Cron Trigger (`[triggers] crons` in `docs-sync-worker/wrangler.toml`) |
| Call the model | REST call to AI Gateway with an `AIG_TOKEN` | Native `env.AI.run(model, input, { gateway: { id: "demo-shop-gateway" } })` — **no token at all** |
| Send the status email | REST call with an `EMAIL_API_TOKEN` | Native `env.EMAIL.send(...)` (`send_email` binding) — **no token at all** |
| Doc-hash / last-checked state | Committed `state.json` | **KV** (`DOCS_SYNC_KV`) — this was never meant to be human-read |
| Commit changes to the repo | `git commit && git push`, then `gh pr create` + `gh pr merge --auto` | `docs-sync-worker/src/github.ts` calls the GitHub REST/Git Data API directly with `fetch()` — reads via the Contents API, writes as one atomic commit straight to `main` via the Git Data API (blob → tree → commit → ref update) |

**By explicit choice, there's no pre-merge build-validation gate.** The
GitHub Actions version ran `npm run build` before merging; a Worker can't run
a real Node/Astro build (no subprocess, no bundler, no filesystem) — the only
way to keep that gate would have been a thin GitHub Actions workflow just for
build-and-merge. Given the automation only ever edits fields already covered
by the Zod schema in `src/content/config.ts` (never `.astro`/component code),
that risk is narrow, and Cloudflare Pages' own build-on-push is still the
backstop: if a bad file ever did land on `main`, Pages' build would fail and
the previous good deployment stays live. If something gets missed or the
model returns a bad response despite the checks below, the plan is to catch
it and adjust `content-sources.json` or the validation rules after the fact.

**How it decides what to touch:** `content-sources.json` (read live from
GitHub on every run — never duplicated into the Worker, so adding a solution
never requires redeploying it) maps each slug to the canonical doc URLs that
back it. The Worker fetches each one as Markdown, hashes it, and compares
against KV. A solution is only regenerated if at least one of its cited docs
actually changed since the last run — most weeks this touches nothing. The
Cloudflare changelog RSS feed is also checked and `productNames` matches
entries against it, but this is informational only (why the run happened) —
it never gates whether a page gets rewritten.

**How it avoids publishing hallucinations:** for a solution whose docs did
change, Workers AI regenerates `blurb`, `solutionPoints`, `faq`, and
`diveDeeper.docs` from the fetched text only, using JSON mode with a schema
that forces a verbatim supporting quote + source URL for every non-obvious
claim. The Worker then independently re-verifies every quote actually appears
in the fetched doc text (case/whitespace insensitive) before accepting
anything — the model's own claim that it followed the rules is never trusted.
Anything that fails to fetch, fails schema validation, fails the quote check,
or drifts too far in length from the current copy is left completely
untouched and called out in the run summary for a human to look at — the
pipeline fails closed, it never force-applies an unverified guess.

**How it avoids unreviewable diffs:** rather than re-serializing the whole
YAML frontmatter with a generic dumper (which reformats every field's
quoting/wrapping and buries the real change), `docs-sync-worker/src/yaml-surgery.ts`
edits only the specific blocks that changed and leaves every other byte —
including `diveDeeper.blogs`, `challenge`, `diagram`, `demo`, etc. — exactly as
a human wrote it. All files changed in a run land in one atomic commit.

**Blog scanning (informational, never auto-published):** each solution in
`content-sources.json` also has a `blogTag` (e.g. `waf` → `web-application-firewall`).
Every run, the Worker checks `blog.cloudflare.com/tag/<slug>/rss/` for posts
published since the last run and lists them in the run summary/changelog/
email as "might be worth a look." Nothing is ever added to `diveDeeper.blogs`
automatically — blog curation is still an editorial call, this just surfaces
candidates so you don't have to go looking. The same `blogTag` also powers a
link on every solution page: "Browse every Cloudflare blog post tagged
'\<label\>'" → `blog.cloudflare.com/tag/<slug>/`. Cloudflare's blog tag slugs
don't reliably follow simple lowercase-hyphenation of the tag name
(`Cloudflare Workers` → `workers`, `Argo Smart Routing` → `argo`,
`Load Balancing` → `loadbalancing`, no hyphen at all) — every slug currently
in `content-sources.json` was verified with `curl -o /dev/null -w '%{http_code}'`
before being added; do the same before adding a new one.

**Where to see what happened:**

- `scripts/docs-sync/CHANGELOG.md` — committed to the repo (so `git log -p` or
  just opening the file gives you permanent history) but lives outside
  `src/content/` and `public/`, so Astro never builds it into the site. An
  entry is only added when a run actually changed something, hit a warning, or
  turned up a changelog/blog match — quiet weeks don't add noise.
- A status email, if `NOTIFY_EMAIL_TO` is configured (see setup below) — sent
  **every run**, including "nothing changed this week," via the native
  `send_email` binding from `support@remydemo.com` (same sender the
  `/email-security/send` demo uses). Subject line tells you the outcome at a
  glance: `updated`, `no changes`, or `needs a look`.
- The commit itself on `main` — its message and (via the `/run` endpoint
  response, or Worker logs) summary text match the changelog/email.

**What's manual:**

- One-time Worker setup (see below) — after that, nothing.
- If a run's grounding check fails or a doc 404s, it's flagged in the
  changelog/email (⚠️) instead of silently applied. Resolving that is a human
  judgment call, e.g. Cloudflare renamed or restructured a product's docs and
  `content-sources.json` needs a new URL (this happened twice during initial
  setup — see `content-sources.json`'s `$comment`).
- Blog posts surfaced as "might be worth a look" — deciding whether to add one
  to a solution's `diveDeeper.blogs` is manual, by design.
- Adding a new solution: also add its `docs` and `blogTag` (and optional
  `productNames`) to `content-sources.json`, or it's silently skipped.
- `demo`, `diagram`, `challenge`, `pillar`, `order`, and `diveDeeper.blogs` are
  never touched by automation — they're product/positioning decisions, not
  facts to verify against docs.

**One-time manual setup required:**

1. Deploy the Worker: `npm run deploy:docs-sync` (wraps
   `wrangler deploy --config docs-sync-worker/wrangler.toml`). This also
   creates the Cron Trigger and wires up the `AI`/`EMAIL`/`DOCS_SYNC_KV`
   bindings declared in `docs-sync-worker/wrangler.toml` — nothing to
   configure by hand in the dashboard for those three.
2. Set three secrets on the Worker (not in `wrangler.toml` — these are the
   only credentials this automation needs):

   ```bash
   npx wrangler secret put GITHUB_TOKEN --config docs-sync-worker/wrangler.toml
   npx wrangler secret put NOTIFY_EMAIL_TO --config docs-sync-worker/wrangler.toml
   npx wrangler secret put TRIGGER_SECRET --config docs-sync-worker/wrangler.toml
   ```

   - **`GITHUB_TOKEN`** — a GitHub **fine-grained personal access token**
     scoped to *only* this repository (`nickremy11/cloudflare-demo-shop`),
     with **Contents: Read and write** permission and nothing else (no Pull
     requests permission needed — this design commits straight to `main`,
     no PRs). Create one at github.com → Settings → Developer settings →
     Personal access tokens → Fine-grained tokens → scope to this repo only.
     This is the one credential a Worker genuinely cannot avoid needing:
     *something* has to be allowed to write to the GitHub repo, and unlike
     GitHub Actions (which gets a scoped token injected automatically), a
     Worker has to bring its own.
   - **`NOTIFY_EMAIL_TO`** — the address you want the weekly status email
     sent to.
   - **`TRIGGER_SECRET`** — any random string you make up. Protects the
     manual-trigger endpoint (see below) so it can't be called by randoms
     hitting the Worker's URL.

3. Trigger a manual run once to confirm everything's wired up before trusting
   the Monday cron unattended:

   ```bash
   curl -X POST "https://demo-shop-docs-sync.<your-subdomain>.workers.dev/run?force=true&slug=waf" \
     -H "Authorization: Bearer <TRIGGER_SECRET>"
   ```

   `force=true` bypasses the doc-hash cache (otherwise the very first run on
   an empty KV namespace already counts as "changed" for every slug, so
   `force` is mostly for repeat-testing the same slug). Drop `&slug=waf` to
   run against all 26 solutions — that's what the Monday cron does.

No `Allow auto-merge` setting, no branch protection rule, no GitHub Actions
secrets — those were specific to the previous design's PR-based flow and
don't apply here.

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
