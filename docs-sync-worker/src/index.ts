// docs-sync-worker — Cloudflare-native weekly Cloudflare-docs accuracy sync
// for src/content/solutions/*.md in the main site repo.
//
// Replaces an earlier GitHub Actions + Node script version with a standalone
// Worker so scheduling, doc/blog fetching, AI generation, and email all run
// on Cloudflare rather than a GitHub-hosted VM:
//   - Cron Trigger (see wrangler.toml `[triggers]`) instead of Actions `schedule:`
//   - Native Workers AI binding (`env.AI`, routed through this site's AI
//     Gateway via the `gateway` option) instead of an AI Gateway REST call —
//     no AIG_TOKEN needed at all.
//   - Native Email Sending binding (`env.EMAIL`) instead of a REST call —
//     no EMAIL_API_TOKEN needed at all.
//   - KV for the doc-hash / last-checked state instead of a git-committed
//     state.json.
// The one thing a Worker genuinely cannot do natively is run `git`/`npm run
// build` — so committing changes to the repo goes through GitHub's REST API
// directly (see github.ts) using a repo-scoped GitHub token, and by design
// (per explicit choice) there is no pre-merge build-validation gate here: if
// something is missed or a bad response slips through, it gets caught and
// adjusted after the fact rather than blocking automation on a CI step this
// Worker can't run anyway. Cloudflare Pages' own build-on-push is still the
// backstop — a schema-invalid file would fail that build and leave the
// previous deployment live.
//
// What happens each run, per solution slug in content-sources.json (fetched
// live from GitHub — not duplicated into this Worker, so adding a solution
// never requires redeploying this Worker):
//   1. Fetch every canonical developers.cloudflare.com URL listed for that
//      slug as Markdown (Accept: text/markdown).
//   2. Hash the combined text and compare it to KV. Unchanged -> skip, no
//      model call, no write.
//   3. If changed (or force=true), ask Workers AI to regenerate `blurb`,
//      `solutionPoints`, `faq`, `diveDeeper.docs` using ONLY the fetched
//      text, with a JSON schema requiring a verbatim quote + source URL per
//      claim — then independently re-verify every quote against the fetched
//      text before accepting anything.
//   4. Apply accepted changes with surgical YAML edits (yaml-surgery.ts) so
//      the diff only touches the fields that changed, and stamp
//      `lastVerified` / `sources`.
//   5. blog.cloudflare.com tag RSS and the Cloudflare changelog RSS are also
//      checked (informational only — surfaced in the run summary / email /
//      changelog, never auto-applied to `diveDeeper.blogs`).
// Anything that fails fetch, generation, validation, or grounding is left
// exactly as-is and reported in the run summary — this fails closed, it
// never publishes an unverified guess.
//
// All changed files (solution pages + scripts/docs-sync/CHANGELOG.md, if
// anything is worth recording) land in ONE atomic commit straight to `main`
// via the GitHub Git Data API — no branch, no PR, no merge step, since
// there's no build gate to wait on. Cloudflare Pages' existing GitHub
// integration picks up that push and deploys it exactly as it would any
// other commit.

import { GeneratedContentSchema, RESPONSE_JSON_SCHEMA, isAllowedSourceUrl } from "./schema";
import {
  splitFrontmatter,
  parseBlocks,
  stringifyBlocks,
  findBlock,
  upsertScalarBlock,
  upsertStringListBlock,
  setTwoFieldListBlock,
  replaceDiveDeeperDocs,
} from "./yaml-surgery";
import { commitFiles, getFile, type GitHubConfig } from "./github";
import { load as yamlLoad } from "js-yaml";

export interface Env {
  AI: Ai;
  EMAIL: SendEmail;
  DOCS_SYNC_KV: KVNamespace;
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH?: string;
  AI_GATEWAY_ID?: string;
  AI_MODEL?: string;
  NOTIFY_EMAIL_TO?: string;
  NOTIFY_EMAIL_FROM?: string;
  TRIGGER_SECRET?: string;
}

const CONTENT_SOURCES_PATH = "content-sources.json";
const SOLUTIONS_DIR = "src/content/solutions";
const CHANGELOG_PATH = "scripts/docs-sync/CHANGELOG.md";
const CHANGELOG_HEADER =
  "# docs-sync run log\n\nLocal record of every docs-sync run, newest first. Not part of the Astro site build (lives under scripts/docs-sync/, outside src/content and public/) — this is for your own reference, not published.\n\n";

const CHANGELOG_RSS_URL = "https://developers.cloudflare.com/changelog/rss/index.xml";
const MAX_DOC_CHARS = 6000;
const MAX_BLURB_LENGTH_DRIFT = 350;
const MAX_CHANGELOG_NOTES_PER_SLUG = 3;
const MAX_BLOG_NOTES_PER_SLUG = 5;

interface SolutionSourceConfig {
  docs: string[];
  productNames?: string[];
  blogTag?: { slug: string; label: string };
}

interface ContentSources {
  solutions: Record<string, SolutionSourceConfig>;
}

interface RssItem {
  title: string;
  link?: string;
  pubDate?: string;
  categories: string[];
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

async function fetchMarkdown(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Accept: "text/markdown",
      "User-Agent": "cloudflare-demo-shop-docs-sync-worker/1.0 (+https://remydemo.com)",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
  return res.text();
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = match[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.trim();
    const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1]?.trim();
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim();
    const categories = [...block.matchAll(/<category>([\s\S]*?)<\/category>/g)].map((c) => c[1].trim());
    if (title) items.push({ title, link, pubDate, categories });
  }
  return items;
}

async function fetchRssItems(url: string): Promise<RssItem[]> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "cloudflare-demo-shop-docs-sync-worker/1.0" } });
    if (!res.ok) return [];
    return parseRssItems(await res.text());
  } catch {
    return [];
  }
}

function itemsSince(items: RssItem[], sinceIso: string | null): RssItem[] {
  const since = sinceIso ? new Date(sinceIso).getTime() : 0;
  return items.filter((item) => {
    if (!item.pubDate) return true;
    const t = new Date(item.pubDate).getTime();
    return Number.isNaN(t) || t >= since;
  });
}

function matchChangelogItems(items: RssItem[], sinceIso: string | null, productNames?: string[]): RssItem[] {
  const names = (productNames || []).map((n) => n.toLowerCase());
  if (names.length === 0) return [];
  return itemsSince(items, sinceIso).filter((item) => {
    const haystack = [item.title, ...item.categories].join(" ").toLowerCase();
    return names.some((n) => haystack.includes(n));
  });
}

async function fetchNewBlogPosts(
  blogTag: { slug: string; label: string } | undefined,
  sinceIso: string | null
): Promise<RssItem[]> {
  if (!blogTag?.slug) return [];
  const items = await fetchRssItems(`https://blog.cloudflare.com/tag/${blogTag.slug}/rss/`);
  return itemsSince(items, sinceIso);
}

function buildPrompt(slug: string, docs: { url: string; text: string }[]) {
  const sourceBlock = docs
    .map(({ url, text }) => {
      const truncated = text.slice(0, MAX_DOC_CHARS);
      const suffix = text.length > MAX_DOC_CHARS ? "\n...[truncated]" : "";
      return `### SOURCE: ${url}\n${truncated}${suffix}`;
    })
    .join("\n\n");

  const system = `You are a technical writer maintaining the Cloudflare Demo Shop, a sales/SE demo site.
You update marketing copy for the "${slug}" solution page using ONLY the Cloudflare documentation
provided below as SOURCE blocks. Rules:
- Never state a fact that is not directly supported by one of the SOURCE blocks.
- Do not invent pricing, limits, model names, or dates that are not in the sources.
- Prefer plain language over jargon; keep the tone of a confident, accurate sales engineer.
- Every URL you output must be copied exactly from a SOURCE header — never alter or guess a URL.
- Output must satisfy the provided JSON schema exactly. No prose outside the JSON.
- "citations" must contain a short verbatim quote (copied exactly, not paraphrased) from the
  SOURCE block that backs each non-obvious claim in blurb/solutionPoints/faq. Include at least
  one citation per SOURCE block you actually used content from.`;

  const user = `${sourceBlock}\n\n---\nUsing only the SOURCE blocks above, regenerate the JSON for the "${slug}" page.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

async function callModel(env: Env, messages: { role: string; content: string }[]): Promise<unknown> {
  const model = env.AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  const gatewayId = env.AI_GATEWAY_ID || "demo-shop-gateway";
  const result: any = await env.AI.run(
    model as any,
    {
      messages,
      response_format: { type: "json_schema", schema: RESPONSE_JSON_SCHEMA },
    } as any,
    { gateway: { id: gatewayId } }
  );
  const raw = typeof result === "string" ? result : result?.response ?? result?.result?.response;
  if (!raw) throw new Error(`Workers AI response had no usable content: ${JSON.stringify(result).slice(0, 300)}`);
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

function verifyGrounding(parsed: any, docsByUrl: Map<string, string>): string[] {
  const problems: string[] = [];
  for (const citation of parsed.citations) {
    if (!isAllowedSourceUrl(citation.url)) {
      problems.push(`citation URL not on developers.cloudflare.com: ${citation.url}`);
      continue;
    }
    const docText = docsByUrl.get(citation.url);
    if (!docText) {
      problems.push(`citation points at a URL that wasn't one of the fetched sources: ${citation.url}`);
      continue;
    }
    if (!normalize(docText).includes(normalize(citation.quote))) {
      problems.push(
        `citation quote not found verbatim in ${citation.url}: "${citation.quote.slice(0, 80)}..."`
      );
    }
  }
  for (const doc of parsed.diveDeeperDocs) {
    if (!isAllowedSourceUrl(doc.url)) {
      problems.push(`diveDeeper doc URL not on developers.cloudflare.com: ${doc.url}`);
    }
  }
  return problems;
}

function applyChangesSurgically(rawFile: string, parsed: any, sourceDocs: string[]): string {
  const { frontmatter, body } = splitFrontmatter(rawFile);
  const blocks = parseBlocks(frontmatter);

  upsertScalarBlock(blocks, "blurb", parsed.blurb);

  const solutionPointsBlock = findBlock(blocks, "solutionPoints");
  if (!solutionPointsBlock) throw new Error('frontmatter has no "solutionPoints" block');
  setTwoFieldListBlock(solutionPointsBlock, parsed.solutionPoints, "title", "detail");

  const faqBlock = findBlock(blocks, "faq");
  if (!faqBlock) throw new Error('frontmatter has no "faq" block');
  setTwoFieldListBlock(faqBlock, parsed.faq, "question", "answer");

  const diveDeeperBlock = findBlock(blocks, "diveDeeper");
  if (!diveDeeperBlock) throw new Error('frontmatter has no "diveDeeper" block');
  replaceDiveDeeperDocs(diveDeeperBlock, parsed.diveDeeperDocs);

  upsertScalarBlock(blocks, "lastVerified", new Date().toISOString().slice(0, 10));
  upsertStringListBlock(blocks, "sources", sourceDocs);

  return `---\n${stringifyBlocks(blocks)}\n---\n${body}`;
}

function readFrontmatterData(rawFile: string): any {
  const { frontmatter } = splitFrontmatter(rawFile);
  return yamlLoad(frontmatter) as any;
}

interface RunOptions {
  force?: boolean;
  targetSlug?: string;
}

async function processSlug(
  env: Env,
  gh: GitHubConfig,
  slug: string,
  config: SolutionSourceConfig,
  force: boolean,
  summary: string[],
  stagedFiles: Map<string, string>
): Promise<void> {
  const path = `${SOLUTIONS_DIR}/${slug}.md`;
  const existing = await getFile(gh, path);
  if (!existing) {
    summary.push(`- **${slug}**: skipped — no matching file at ${path}`);
    return;
  }

  const docs: { url: string; text: string }[] = [];
  for (const url of config.docs) {
    try {
      docs.push({ url, text: await fetchMarkdown(url) });
    } catch (err: any) {
      summary.push(`- **${slug}**: skipped — could not fetch ${url} (${err.message})`);
      return;
    }
  }

  const combinedHash = await sha256(docs.map((d) => `${d.url}\n${d.text}`).join("\n---\n"));
  const hashKey = `hash:${slug}`;
  const previousHash = await env.DOCS_SYNC_KV.get(hashKey);
  const dirty = force || previousHash !== combinedHash;

  await env.DOCS_SYNC_KV.put(hashKey, combinedHash);

  if (!dirty) return;

  let parsed: any;
  try {
    const messages = buildPrompt(slug, docs);
    const modelOutput = await callModel(env, messages);
    parsed = GeneratedContentSchema.parse(modelOutput);
  } catch (err: any) {
    summary.push(
      `- **${slug}**: ⚠️ source docs changed but generation/validation failed — left as-is (${err.message})`
    );
    return;
  }

  const docsByUrl = new Map(docs.map((d) => [d.url, d.text]));
  const problems = verifyGrounding(parsed, docsByUrl);
  if (problems.length > 0) {
    summary.push(
      `- **${slug}**: ⚠️ source docs changed but the grounding check failed — left as-is\n  - ${problems.join("\n  - ")}`
    );
    return;
  }

  const oldData = readFrontmatterData(existing.content);
  const oldBlurbLen = (oldData?.blurb || "").length;
  if (Math.abs(parsed.blurb.length - oldBlurbLen) > MAX_BLURB_LENGTH_DRIFT) {
    summary.push(
      `- **${slug}**: ⚠️ generated blurb length changed too drastically (${oldBlurbLen} → ${parsed.blurb.length} chars) — left as-is, needs a human look`
    );
    return;
  }

  const updatedFile = applyChangesSurgically(existing.content, parsed, config.docs);
  readFrontmatterData(updatedFile); // sanity parse before staging

  stagedFiles.set(path, updatedFile);
  summary.push(
    `- **${slug}**: ✅ updated (blurb, solutionPoints, faq, diveDeeper.docs) from ${docs.length} source doc(s), ${parsed.citations.length} citation(s) verified against live docs`
  );
}

async function sendNotificationEmail(env: Env, runDateIso: string, subject: string, bodyText: string): Promise<string> {
  if (!env.NOTIFY_EMAIL_TO) return "skipped (NOTIFY_EMAIL_TO not set)";
  const from = env.NOTIFY_EMAIL_FROM || "support@remydemo.com";
  try {
    await env.EMAIL.send({
      to: env.NOTIFY_EMAIL_TO,
      from: { address: from, name: "Cloudflare Demo Shop" },
      subject,
      html: `<div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; white-space: pre-wrap;">${bodyText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</div>`,
      text: bodyText,
    } as any);
    return `sent to ${env.NOTIFY_EMAIL_TO}`;
  } catch (err: any) {
    return `failed: ${err.message}`;
  }
}

export async function runDocsSync(env: Env, opts: RunOptions = {}): Promise<string> {
  const gh: GitHubConfig = {
    token: env.GITHUB_TOKEN,
    owner: env.GITHUB_OWNER,
    repo: env.GITHUB_REPO,
    branch: env.GITHUB_BRANCH || "main",
  };

  const sourcesFile = await getFile(gh, CONTENT_SOURCES_PATH);
  if (!sourcesFile) throw new Error(`Could not read ${CONTENT_SOURCES_PATH} from ${gh.owner}/${gh.repo}@${gh.branch}`);
  const sources: ContentSources = JSON.parse(sourcesFile.content);

  const slugs = opts.targetSlug ? [opts.targetSlug] : Object.keys(sources.solutions);

  const lastChangelogCheck = await env.DOCS_SYNC_KV.get("lastChangelogCheck");
  const lastBlogCheck = await env.DOCS_SYNC_KV.get("lastBlogCheck");
  const changelogItems = await fetchRssItems(CHANGELOG_RSS_URL);

  const summary: string[] = [];
  const changelogNotes: string[] = [];
  const blogNotes: string[] = [];
  const stagedFiles = new Map<string, string>();

  for (const slug of slugs) {
    const config = sources.solutions[slug];
    if (!config) {
      summary.push(`- **${slug}**: skipped — not present in content-sources.json`);
      continue;
    }

    const related = matchChangelogItems(changelogItems, lastChangelogCheck, config.productNames).slice(
      0,
      MAX_CHANGELOG_NOTES_PER_SLUG
    );
    for (const item of related) {
      changelogNotes.push(`- [${item.title}](${item.link}) — related to \`${slug}\``);
    }

    const newBlogPosts = (await fetchNewBlogPosts(config.blogTag, lastBlogCheck)).slice(0, MAX_BLOG_NOTES_PER_SLUG);
    for (const post of newBlogPosts) {
      blogNotes.push(`- [${post.title}](${post.link}) — tagged "${config.blogTag!.label}", relevant to \`${slug}\``);
    }

    await processSlug(env, gh, slug, config, Boolean(opts.force), summary, stagedFiles);
  }

  const runDateIso = new Date().toISOString();
  await env.DOCS_SYNC_KV.put("lastChangelogCheck", runDateIso);
  await env.DOCS_SYNC_KV.put("lastBlogCheck", runDateIso);

  const hadChanges = summary.some((line) => line.includes("✅"));
  const hadWarnings = summary.some((line) => line.includes("⚠️"));
  const worthRecording = hadChanges || hadWarnings || changelogNotes.length > 0 || blogNotes.length > 0;

  const lines = [
    "## Weekly Cloudflare docs sync",
    "",
    `Ran ${runDateIso} against ${slugs.length} solution(s).`,
    "",
    "### Changes",
    summary.length > 0 ? summary.join("\n") : "- No solution copy changed this run.",
  ];

  if (changelogNotes.length > 0) {
    lines.push("", "### Related Cloudflare changelog activity this week", ...changelogNotes);
  }

  if (blogNotes.length > 0) {
    lines.push(
      "",
      "### New Cloudflare blog posts that might be worth a look",
      "_Informational only — never auto-added to `diveDeeper.blogs`. Review and add manually if relevant._",
      ...blogNotes
    );
  }

  lines.push(
    "",
    "---",
    "_Generated copy is only accepted when every non-obvious claim is backed by a verbatim quote from the cited developers.cloudflare.com page (see `verifyGrounding` in docs-sync-worker/src/index.ts). Anything that fails that check, or drifts too far in length from the current copy, is left untouched and flagged above for manual review instead of being force-applied._"
  );

  let commitSha: string | null = null;
  if (worthRecording) {
    const changelogFile = await getFile(gh, CHANGELOG_PATH);
    const existingBody = changelogFile
      ? changelogFile.content.startsWith(CHANGELOG_HEADER)
        ? changelogFile.content.slice(CHANGELOG_HEADER.length)
        : changelogFile.content
      : "";
    const entry = `## ${runDateIso}\n\n${lines.join("\n")}\n\n---\n\n`;
    stagedFiles.set(CHANGELOG_PATH, CHANGELOG_HEADER + entry + existingBody);
  }

  if (stagedFiles.size > 0) {
    const files = [...stagedFiles.entries()].map(([path, content]) => ({ path, content }));
    try {
      commitSha = await commitFiles(
        gh,
        files,
        `docs-sync: weekly Cloudflare docs accuracy check (${runDateIso.slice(0, 10)})`
      );
    } catch (err: any) {
      lines.push("", `⚠️ Failed to commit changes to GitHub: ${err.message}`);
    }
  }

  const summaryText = lines.join("\n") + (commitSha ? `\n\nCommit: https://github.com/${gh.owner}/${gh.repo}/commit/${commitSha}\n` : "\n");

  const status = hadWarnings ? "needs a look" : hadChanges ? "updated" : "no changes";
  const emailResult = await sendNotificationEmail(
    env,
    runDateIso,
    `Docs sync (${runDateIso.slice(0, 10)}): ${status}`,
    summaryText
  );

  return `${summaryText}\n(email: ${emailResult})`;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runDocsSync(env).then(
        (summary) => console.log(summary),
        (err) => console.error("docs-sync run failed:", err)
      )
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/run") {
      return new Response(
        "docs-sync worker.\n\nPOST /run with `Authorization: Bearer <TRIGGER_SECRET>` to trigger a manual run.\nOptional query params: ?force=true&slug=waf\n",
        { status: 200 }
      );
    }

    const auth = request.headers.get("Authorization");
    if (!env.TRIGGER_SECRET || auth !== `Bearer ${env.TRIGGER_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const summary = await runDocsSync(env, {
        force: url.searchParams.get("force") === "true",
        targetSlug: url.searchParams.get("slug") || undefined,
      });
      return new Response(summary, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
    } catch (err: any) {
      return new Response(`docs-sync run failed: ${err.message}\n${err.stack || ""}`, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
