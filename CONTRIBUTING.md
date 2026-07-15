# Contributing — How to add things to the Demo Shop

This file is for **humans and AI agents** who want to add or change content on
the Cloudflare Demo Shop. Open this first.

The site is built with [Astro](https://astro.build) (static output) and deploys
to Cloudflare Pages. All 26 solution pages are generated from `.md` files in
`src/content/solutions/`. Interactive demos are `.astro` components in
`src/components/demos/`. Anything in `functions/api/[[path]].ts` is a Hono
route handler running as a Cloudflare Pages Function.

---

## Quick reference

| Task | Where |
|---|---|
| Add a new solution (page + homepage card) | `src/content/solutions/<slug>.md` |
| Add a new interactive demo | `src/components/demos/<Name>.astro` + register in `DemoSlot.astro` |
| Add a new API endpoint | `functions/api/[[path]].ts` (Hono route) |
| Modify the chat room Durable Object | `chat-worker/src/index.ts` + deploy that Worker |
| Update homepage hero copy | `src/pages/index.astro` |
| Update pillar names / order | `src/data/pillars.ts` |
| Change site-wide styling | `src/styles/global.css` |
| Change header / footer / chat widget | `src/components/Header.astro`, `Footer.astro`, `ChatWidget.astro` |
| Add a diagram | Drop the PNG in `public/diagrams/` and reference it from the solution `.md` |
| Update the chatbot's system prompt | The `systemPrompt` string in `functions/api/[[path]].ts` (`POST /api/chat`) |

---

## Recipe 1 — Add a new solution

### Step 1. Decide the slug

The slug is the URL. `/zero-trust`, `/waf`, `/cloud-storage`, etc. Lowercase,
hyphen-separated, no trailing slash. Must be unique against the existing 26
(see `## Current solutions` at the bottom).

### Step 2. Create the markdown file

Path: `src/content/solutions/<slug>.md`

**Paste-ready template:**

```yaml
---
title: "Solution Name (shown on card + page heading)"
blurb: "One- or two-sentence elevator pitch. Shown on the homepage card and as the page subhead."
pillar: "app-security"   # one of: sase | app-security | developer | network
order: 99                # within the pillar, smaller numbers appear first

challenge:
  question: "What is the headline problem this solves?"
  detail: "A paragraph (3-5 sentences) explaining the pain — why teams care, what hurts today, what happens when it's not solved."

diagram:                  # optional — omit the whole block if no diagram yet
  src: "/diagrams/your-image.png"
  alt: "Short alt text"
  caption: "Optional one-liner shown under the image"

solutionPoints:
  - title: "Headline of the first bullet. "
    detail: "Why this matters and what specifically Cloudflare does. One or two sentences."
  - title: "Second bullet. "
    detail: "..."
  - title: "Third bullet. "
    detail: "..."
  # Aim for 3-5 bullets. Each one is shown with a checkmark in the rendered list.

faq:
  - question: "A real question someone in a sales / SE / customer call asks?"
    answer: "Direct answer. Inline <code>HTML</code> is allowed (rendered with set:html)."
  - question: "Second question?"
    answer: "..."
  # Aim for 3-5 questions.

demo:
  type: "coming-soon"     # one of: interactive | coming-soon | external-link
  # Additional fields by type:
  # If type=interactive:    component: "WafDemo"      (must match a registered DemoSlot key)
  # If type=external-link:  externalUrl: "https://..."
  # note: "Optional one-liner shown above the demo box on the page"

diveDeeper:
  docs:
    - title: "Docs page title"
      url: "https://developers.cloudflare.com/..."
    - title: "Another docs link"
      url: "https://developers.cloudflare.com/..."
  blogs:
    - title: "Blog post title"
      url: "https://blog.cloudflare.com/..."
---
```

### Step 3. Pick a pillar slug

Use exactly one of: `sase`, `app-security`, `developer`, `network`.

Pillars are defined in `src/data/pillars.ts`. To add a fifth pillar, edit that
file (add the `Pillar` object) and the new pillar will render automatically
on the homepage when solutions reference its slug.

### Step 4. Build and verify

```bash
npm run build
```

Astro generates `/your-slug` automatically. The homepage card appears in its
pillar's section. If the build fails, the error message will point to the
schema mismatch in your frontmatter (the schema lives in
`src/content/config.ts`).

### Step 5. (Optional) Add a diagram

Drop a PNG in `public/diagrams/<file>.png`. Reference it in the solution
frontmatter:

```yaml
diagram:
  src: "/diagrams/<file>.png"
  alt: "What's in the diagram"
  caption: "Optional caption"
```

The same PNGs are also stored in the R2 `demo-shop-diagrams` bucket for the
`/diagrams` browser. To upload to R2 use `upload_diagram.py` (it exists in
the repo root).

---

## Recipe 2 — Add a new interactive demo

### Step 1. Create the demo component

Path: `src/components/demos/<YourDemoName>.astro`

**Minimal skeleton:**

```astro
---
// Brief explanation of what this demo does and which APIs it hits.
---

<div x-data="myDemo()" class="space-y-4">
  <p class="text-sm text-gray-600">
    Explain to the user what they're about to do.
  </p>

  <button type="button" @click="run" :disabled="loading" class="btn-primary">
    <span x-show="!loading">Run demo</span>
    <span x-show="loading">Running...</span>
  </button>

  <div x-show="result" x-transition class="demo-panel safe">
    <h3>Result</h3>
    <pre class="code-output" x-text="result"></pre>
  </div>
</div>

<script is:inline>
  function myDemo() {
    return {
      loading: false,
      result: "",
      async run() {
        this.loading = true;
        try {
          const res = await fetch("/api/your-endpoint");
          this.result = JSON.stringify(await res.json(), null, 2);
        } catch (e) {
          this.result = "Error: " + (e?.message ?? e);
        } finally {
          this.loading = false;
        }
      },
    };
  }
</script>
```

**Style classes available** (from `src/styles/global.css`):

- `.btn-primary`, `.btn-secondary`, `.btn-danger` — buttons
- `.demo-panel`, `.demo-panel.safe`, `.demo-panel.danger` — colored panels
- `.demo-input` — styled `<input>` / `<textarea>` / `<select>`
- `.code-output`, `.code-output.terminal` — monospace blocks
- `.status-badge`, `.status-badge.success`, `.status-badge.danger` — pills
- `.inspector`, `.inspector-tabs`, `.inspector-tab`, `.inspector-body` —
  the dark request/response inspector
- `.demo-columns` — two-column responsive grid

Alpine.js v3 is loaded globally (CDN, in `Base.astro`). Use `x-data`, `x-show`,
`x-text`, `@click`, etc. directly. Don't import Alpine — it's already there.

### Step 2. Register the component in DemoSlot

Edit `src/components/DemoSlot.astro`:

```astro
// 1. Import at the top of the frontmatter
import YourDemoName from "./demos/YourDemoName.astro";

// 2. Add to the DEMO_COMPONENTS map
const DEMO_COMPONENTS: Record<string, any> = {
  WafDemo,
  BotRateDemo,
  // ... existing entries ...
  YourDemoName,    // ← add this line
};
```

### Step 3. Wire it to a solution

In the solution's `.md` frontmatter:

```yaml
demo:
  type: "interactive"
  component: "YourDemoName"     # exact string match against the lookup key
  note: "Optional one-liner above the demo box"
```

### Step 4. If you need a server endpoint

Add a route in `functions/api/[[path]].ts` (Hono syntax):

```typescript
app.get("/api/your-endpoint", async (c) => {
  return c.json({ ok: true, timestamp: Date.now() });
});
```

Bindings available on `c.env`:

- `STORAGE_BUCKET` — R2 bucket for user uploads
- `DIAGRAMS_BUCKET` — R2 bucket for architecture diagrams
- `DEMO_KV` — KV namespace for metadata
- `AI` — Workers AI binding
- `CHAT_ROOM` — Durable Object namespace bound to the `ChatRoom` class in the standalone `demo-shop-chat` Worker
- `AIG_TOKEN` — AI Gateway auth token (secret)
- `CF_ZONE_ID`, `CF_CACHE_PURGE_TOKEN` — for cache purge calls
- `TURNSTILE_SECRET` — Turnstile widget secret

Pages Functions are hot-reloaded by `wrangler pages dev`. No build step.

### Step 5. Test

```bash
npm run build                # confirms the demo wires up
npm run dev:full             # full stack with Pages Functions (needs wrangler login)
```

If `dev:full` has trouble with the AI remote binding, use `npm run dev` for
the Astro side and the production deploy for the API side.

---

## Recipe 3 — Add an external-link demo

Some solutions (Browser Isolation, for example) demo via a real external site
that's protected by an upstream Cloudflare policy. No interactive component
needed — just a styled link button.

In the solution `.md` frontmatter:

```yaml
demo:
  type: "external-link"
  externalUrl: "https://blog.cloudflare.com"
  note: "Explain to the user why clicking this link demos the product. e.g. 'When your device is enrolled in CF Gateway with a Browser Isolation policy, this opens in an isolated browser session.'"
```

Done. No further code required.

---

## Recipe 4 — Add a "coming soon" placeholder

Default state. Just set:

```yaml
demo:
  type: "coming-soon"
```

The page renders a polished "Demo coming soon" panel automatically.

---

## Recipe 5 — Change the homepage hero, header, or footer

| Element | File |
|---|---|
| Hero copy on homepage | `src/pages/index.astro` (the `<section>` at the top of the `<Base>` block) |
| Top header bar (logo, nav) | `src/components/Header.astro` |
| Footer | `src/components/Footer.astro` |
| Floating chat widget | `src/components/ChatWidget.astro` |
| Chatbot system prompt | `functions/api/[[path]].ts`, inside the `POST /api/chat` handler |

To hide the chat widget on a specific page:

```astro
<Base title="..." hideChat={true}>
  ...
</Base>
```

---

## Recipe 6 — Add a new pillar

Edit `src/data/pillars.ts`. Append to the `PILLARS` array:

```typescript
{
  slug: "new-pillar",
  label: "New Pillar Section Heading",
  badge: "NewPillar",         // short label on cards
  blurb: "One-line description shown under the heading.",
  order: 5,                    // homepage section order
},
```

Then update the schema in `src/content/config.ts` to add the new slug to the
`pillar` enum:

```typescript
pillar: z.enum(["sase", "app-security", "developer", "network", "new-pillar"]),
```

Any solution `.md` file can now use `pillar: "new-pillar"` and it'll render
in the new section.

---

## Recipe 7 — Work with the Durable Objects chat room

The `/durable-objects` page is special: the UI and HTTP routes live in the
Pages project, but the `ChatRoom` Durable Object class lives in a **separate
Worker** under `chat-worker/`.

### Why it's split this way

Cloudflare Pages can bind to a Durable Object class, but it does **not** own
the class definition itself. The class must live in a Worker script.

Current architecture:

```text
Browser (/durable-objects)
  -> ChatRoomDemo.astro
  -> /api/chatroom/* (Pages Functions, Hono)
  -> CHAT_ROOM binding
  -> demo-shop-chat Worker
  -> ChatRoom Durable Object (SQLite + WebSockets + alarm)
```

### Files involved

| File | Responsibility |
|---|---|
| `chat-worker/src/index.ts` | `ChatRoom` DO class, SQLite schema, broadcast, daily reset alarm |
| `chat-worker/wrangler.toml` | Worker name + DO migration config |
| `wrangler.toml` | Pages binding to the DO via `script_name = "demo-shop-chat"` |
| `functions/api/[[path]].ts` | REST routes and WebSocket upgrade proxy |
| `src/components/demos/ChatRoomDemo.astro` | UI, WebSocket client, countdown, send/clear interactions |

### Deploy order

If you change **`chat-worker/src/index.ts`**, deploy the Worker first:

```bash
npx wrangler deploy --config chat-worker/wrangler.toml
npm run deploy
```

If you only change Astro / Pages Functions / content, a normal Pages deploy is
enough.

### Current chat routes

All are defined in `functions/api/[[path]].ts`:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/chatroom/messages` | Load last 25 messages + next reset time |
| GET | `/api/chatroom/ws` | WebSocket upgrade, proxied directly to the DO |
| POST | `/api/chatroom/send` | Validate + PG moderation + store + broadcast |
| POST | `/api/chatroom/clear` | Clear the room for everyone |

### What the DO currently does

- Single global room (`getByName("global")`)
- SQLite-backed message history (last 25 messages retained)
- WebSocket hibernation fan-out to all connected clients
- Daily reset alarm at **17:00 UTC**
- PG moderation is enforced **before** messages are stored, in the Pages route,
  via Llama Guard 3 (`@cf/meta/llama-guard-3-8b`) using the existing `AI`
  binding.

### RPC typing note

The Pages script cannot import the `ChatRoom` class directly, so the route file
declares a local `ChatRoomStub` interface and casts:

```ts
const stub = c.env.CHAT_ROOM.getByName("global") as unknown as ChatRoomStub;
```

This is intentional. It gives typed RPC calls in the Pages script without
creating a hard package dependency between the two Workers.

---

## Current solutions

The 26 existing slugs. **Don't reuse these.**

**SASE / Workspace Security:**
`zero-trust`, `secure-web-gateway`, `browser-isolation`, `casb`, `email-security`

**App Security & Performance:**
`waf`, `bot-management`, `api-security`, `client-side-security`, `l7-ddos`,
`turnstile`, `cdn-caching`, `argo`, `load-balancing`, `image-optimization`, `dns`

**Developer Platform:**
`workers`, `workers-ai`, `cloud-storage`, `ai-gateway`, `pages`, `durable-objects`

**Network Security:**
`magic-transit`, `cloudflare-wan`, `magic-firewall`, `spectrum`

## Current interactive demo components

Registered in `src/components/DemoSlot.astro`. Reference these in the
`component:` field of a solution's frontmatter.

| Component | Used by | What it does |
|---|---|---|
| `WafDemo` | `/waf` | Fires SQLi/XSS/cmdi/header attacks at `/api/waf/testattack` |
| `BotRateDemo` | `/bot-management` | Shows `_cfbm` cookie, rate-limit burst tester |
| `CdnCacheDemo` | `/cdn-caching` | Fetches diagram + shows cache headers/TTFB + real purge |
| `DnsDemo` | `/dns` | DoH lookups via `1.1.1.1/dns-query` (browser → CF directly) |
| `TurnstileDemo` | `/turnstile` | Scenario picker linking to `/turnstile/login?scenario=human\|interactive\|blocked` |
| `WorkersAiDemo` | `/workers`, `/workers-ai` | Sends prompt through `/api/chat` → AI Gateway → Llama 3.3 70B |
| `AiGatewayDemo` | `/ai-gateway` | Same chat pipeline; shows the routing explicitly |
| `R2Demo` | `/cloud-storage` | Guest+Access upload, malicious scan, pricing calculator |
| `ChatRoomDemo` | `/durable-objects` | Real-time DO chat room with SQLite, WebSockets, daily reset, and Llama Guard PG moderation |

## Current API routes

All in `functions/api/[[path]].ts`.

| Method | Path | Auth | Used by |
|---|---|---|---|
| GET | `/api/waf/testattack?type=sqli\|xss\|cmdi\|header` | none | WAF demo |
| GET | `/api/waf-test?attack=...` | none | Legacy alias for the above |
| GET | `/api/rate-limit-test` | none | Bot+Rate demo |
| GET | `/api/debug-headers` | none | Debugging |
| GET | `/api/auth/whoami` | Access JWT | R2 demo auth check |
| POST | `/api/r2/upload` | Access OR guest+email | R2 demo upload |
| GET | `/api/r2/list` | Access | R2 demo file list |
| GET | `/api/r2/download/:fileId` | Access | R2 demo download |
| DELETE | `/api/r2/delete/:fileId` | Access | R2 demo delete |
| GET | `/api/diagrams/list` | none | Diagrams browser |
| PUT | `/api/diagrams/:name/tags` | none | Tag mgmt |
| GET | `/api/diagrams/:name` | none | Cached diagram stream |
| POST | `/api/cache/purge` | none (server uses CF token) | CDN demo purge |
| GET | `/api/turnstile/config?scenario=human\|interactive\|blocked` | none | Turnstile demo — sitekey for the scenario (server picks the key, not the browser) |
| POST | `/api/turnstile/verify` | none | Turnstile demo — siteverify, secret picked server-side from the same scenario map |
| POST | `/api/chat` | none | Chatbot + Workers AI + AI Gateway demos |
| GET | `/api/chatroom/messages` | none | DO chat room initial history |
| GET | `/api/chatroom/ws` | none | DO chat room WebSocket upgrade |
| POST | `/api/chatroom/send` | none | DO chat room send + PG moderation |
| POST | `/api/chatroom/clear` | none | DO chat room clear |

---

## Common gotchas

- **Astro parsing errors on Alpine multi-line expressions.** If you write
  `:class="foo === bar ? 'a' : 'b'"` and split it across multiple lines,
  Astro's TS parser may complain. Keep `:class` expressions on a single line
  inside the attribute value.
- **Alpine 3 auto-calls `init()` — don't also add `x-init="init()"`.** If the
  object returned by `x-data` defines an `init()` method, Alpine runs it
  automatically on mount. Adding `x-init="init()"` as well calls it a second
  time. In the chat room this created two WebSocket connections and every
  message appeared twice.
- **`x-show` without `style="display: none;"`.** Alpine hides elements after
  it loads, so on first paint they flash visible. Add `style="display: none;"`
  inline to anything that should be hidden by default.
- **`set:html` vs `{value}`.** FAQ answers use `set:html` so HTML in answer
  strings renders. Don't pass user-controlled HTML into anywhere that uses
  `set:html`.
- **WebSocket upgrades must bypass response-rewriting middleware.** Any code
  that wraps a `101` response in `new Response(...)` drops the non-standard
  `webSocket` property and silently breaks the handshake. This affected both
  Hono's CORS middleware and the global `functions/_middleware.js`. For WebSocket
  paths, intercept the request before middleware and return the DO's response
  untouched.
- **Pages + standalone DOs require deploy order awareness.** If Pages binds to a
  DO class in another Worker via `script_name`, that Worker must already exist.
  Otherwise Pages deployment fails with `Error 8000109: Script not found`.
- **Don't use server-provided ids directly as Alpine render keys unless you're
  sure they're stable across all paths.** The chat room now stamps a client-side
  `_k` counter on each message so `x-for` identity never depends on RPC /
  broadcast serialization details.
- **Pages Functions don't auto-rebuild on file changes during `astro dev`.**
  Use `npm run dev:full` if you're working on API routes, or just deploy.
- **Pillar URL collision.** The pillar with slug `developer` has a solution
  called `pages` (`/pages`). The pillar slug is internal only — it doesn't
  collide with the URL.

---

## Build & deploy

```bash
npm run dev         # Astro dev server (frontend only, fast)
npm run dev:full    # build + wrangler pages dev (full stack, slower)
npm run build       # one-shot static build to dist/
npm run deploy      # build + wrangler pages deploy
```

Auto-deploy: pushing to `main` deploys via the GitHub ↔ Cloudflare Pages
integration. No manual step needed for normal updates.

Secrets / env vars are set in the Cloudflare Pages dashboard (Settings →
Environment variables), not in `wrangler.toml`. See the README for the list.
