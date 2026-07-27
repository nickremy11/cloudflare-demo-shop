#!/usr/bin/env node
// Weekly Cloudflare-docs accuracy sync for src/content/solutions/*.md.
//
// Run by .github/workflows/docs-sync.yml every Monday 08:00 UTC (and on manual
// workflow_dispatch). See README.md → "Keeping content in sync with Cloudflare
// docs" for the full design and the one-time manual setup this depends on.
//
// What it does, per solution slug in content-sources.json:
//   1. Fetches every canonical developers.cloudflare.com URL listed for that
//      slug as Markdown (Accept: text/markdown).
//   2. Hashes the combined text and compares it to the last known hash in
//      scripts/docs-sync/state.json. If nothing changed upstream, the slug is
//      left completely alone — no model call, no file write.
//   3. If a doc changed (or FORCE=true), asks Workers AI (via this site's own
//      AI Gateway) to regenerate `blurb`, `solutionPoints`, `faq`, and
//      `diveDeeper.docs` using ONLY the fetched text, with a JSON schema that
//      requires a verbatim supporting quote + source URL for every claim.
//   4. Independently re-validates the response against Zod, and re-checks
//      every quote against the fetched doc text before accepting anything —
//      the model's own claim that it followed the rules is never trusted.
//   5. Applies accepted changes with surgical YAML edits (yaml-surgery.mjs) so
//      the diff only touches the fields that actually changed, and stamps
//      `lastVerified` / `sources` so the site can show when a page was last
//      checked against live docs.
// Anything that fails fetch, generation, validation, or grounding is left
// exactly as it was and reported in the run summary for manual follow-up —
// this script fails closed, never publishes an unverified guess.
//
// Two more things happen every run, independent of the above:
//   - Each solution's `content-sources.json` `blogTag` is checked against
//     blog.cloudflare.com's tag RSS feed for new posts since the last run.
//     This is purely informational (never auto-applied to `diveDeeper.blogs`)
//     — surfaced in the run summary/changelog/email for a human to review.
//   - A run entry is appended to scripts/docs-sync/CHANGELOG.md (git-committed,
//     but outside src/content/ and public/, so never built into the site —
//     it's a private record) and, if EMAIL_API_TOKEN + NOTIFY_EMAIL_TO are
//     set, a status email is sent via Cloudflare Email Sending, every run,
//     whether or not anything changed.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import matter from "gray-matter";
import {
  RESPONSE_JSON_SCHEMA,
  GeneratedContentSchema,
  isAllowedSourceUrl,
} from "./schema.mjs";
import {
  splitFrontmatter,
  parseBlocks,
  stringifyBlocks,
  findBlock,
  upsertScalarBlock,
  upsertStringListBlock,
  setTwoFieldListBlock,
  replaceDiveDeeperDocs,
} from "./yaml-surgery.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const CONTENT_SOURCES_PATH = path.join(REPO_ROOT, "content-sources.json");
const STATE_PATH = path.join(__dirname, "state.json");
const SOLUTIONS_DIR = path.join(REPO_ROOT, "src", "content", "solutions");
const SUMMARY_PATH = path.join(REPO_ROOT, ".docs-sync-summary.md");
// Committed to git so you can browse run history with `git log -p` or just
// open the file — but lives outside src/content and public/, so Astro never
// builds it into the site. This is the "for myself, not pushed to site" log.
const CHANGELOG_PATH = path.join(__dirname, "CHANGELOG.md");

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || "e2e9b1cd0acebaaf2aee23d918eee2b1";
const EMAIL_API_TOKEN = process.env.EMAIL_API_TOKEN;
const NOTIFY_EMAIL_TO = process.env.NOTIFY_EMAIL_TO;
const NOTIFY_EMAIL_FROM = process.env.NOTIFY_EMAIL_FROM || "docs-sync@remydemo.com";

const AIG_TOKEN = process.env.AIG_TOKEN;
const AI_GATEWAY_URL =
  process.env.AI_GATEWAY_URL ||
  "https://gateway.ai.cloudflare.com/v1/e2e9b1cd0acebaaf2aee23d918eee2b1/demo-shop-gateway/compat/chat/completions";
const AI_MODEL = process.env.AI_MODEL || "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const FORCE = /^true$/i.test(process.env.FORCE || "");
const TARGET_SLUGS = (process.env.TARGET_SLUG || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const CHANGELOG_RSS_URL = "https://developers.cloudflare.com/changelog/rss/index.xml";
const MAX_DOC_CHARS = 6000; // per source doc — keeps the prompt bounded
const MAX_BLURB_LENGTH_DRIFT = 350; // guard against runaway regeneration
const MAX_CHANGELOG_NOTES_PER_SLUG = 3; // productNames matching is best-effort/informational only
const MAX_BLOG_NOTES_PER_SLUG = 5;

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function normalize(text) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

async function loadJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

async function fetchMarkdown(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "text/markdown",
      "User-Agent": "cloudflare-demo-shop-docs-sync/1.0 (+https://remydemo.com)",
    },
  });
  if (!res.ok) {
    throw new Error(`Fetch failed (${res.status}) for ${url}`);
  }
  return res.text();
}

function parseRssItems(xml) {
  const items = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = match[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.trim();
    const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1]?.trim();
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim();
    const categories = [...block.matchAll(/<category>([\s\S]*?)<\/category>/g)].map((c) =>
      c[1].trim()
    );
    if (title) items.push({ title, link, pubDate, categories });
  }
  return items;
}

async function fetchRssItems(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "cloudflare-demo-shop-docs-sync/1.0" },
    });
    if (!res.ok) return [];
    return parseRssItems(await res.text());
  } catch {
    return [];
  }
}

function itemsSince(items, sinceIso) {
  const since = sinceIso ? new Date(sinceIso).getTime() : 0;
  return items.filter((item) => {
    if (!item.pubDate) return true; // no date on the item — can't exclude it, so include it
    const t = new Date(item.pubDate).getTime();
    return Number.isNaN(t) || t >= since;
  });
}

function matchChangelogItems(items, sinceIso, productNames) {
  const names = (productNames || []).map((n) => n.toLowerCase());
  if (names.length === 0) return [];
  return itemsSince(items, sinceIso).filter((item) => {
    const haystack = [item.title, ...(item.categories || [])].join(" ").toLowerCase();
    return names.some((n) => haystack.includes(n));
  });
}

// Best-effort discovery of blog posts that might cover a feature update —
// purely informational (surfaced in the run summary / changelog / email so a
// human can decide whether to add one to a solution's `diveDeeper.blogs`).
// Never applied automatically: blog curation stays an editorial decision.
async function fetchNewBlogPosts(blogTag, sinceIso) {
  if (!blogTag?.slug) return [];
  const items = await fetchRssItems(`https://blog.cloudflare.com/tag/${blogTag.slug}/rss/`);
  return itemsSince(items, sinceIso);
}

function buildPrompt(slug, docs) {
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

async function callModel(messages) {
  if (!AIG_TOKEN) {
    throw new Error("AIG_TOKEN is not set — cannot call AI Gateway.");
  }
  const res = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      "cf-aig-authorization": `Bearer ${AIG_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      stream: false,
      response_format: {
        type: "json_schema",
        schema: RESPONSE_JSON_SCHEMA,
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI Gateway request failed (${res.status}): ${detail.slice(0, 500)}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI Gateway response had no message content.");
  }
  return typeof content === "string" ? JSON.parse(content) : content;
}

function verifyGrounding(parsed, docsByUrl) {
  const problems = [];
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

function applyChangesSurgically(rawFile, parsed, sourceDocs) {
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

async function processSlug(slug, config, state, summary) {
  const filePath = path.join(SOLUTIONS_DIR, `${slug}.md`);
  let rawFile;
  try {
    rawFile = await readFile(filePath, "utf8");
  } catch {
    summary.push(`- **${slug}**: skipped — no matching file at src/content/solutions/${slug}.md`);
    return;
  }

  const docs = [];
  for (const url of config.docs) {
    try {
      const text = await fetchMarkdown(url);
      docs.push({ url, text });
    } catch (err) {
      summary.push(`- **${slug}**: skipped — could not fetch ${url} (${err.message})`);
      return;
    }
  }

  const combinedHash = sha256(docs.map((d) => `${d.url}\n${d.text}`).join("\n---\n"));
  const previousHash = state.docs[slug];
  const dirty = FORCE || previousHash !== combinedHash;

  // Refresh the stored hash regardless of outcome so next week's diff is
  // against today's docs, even if generation below ends up failing.
  state.docs[slug] = combinedHash;

  if (!dirty) return; // nothing changed upstream — leave the file untouched

  let parsed;
  try {
    const messages = buildPrompt(slug, docs);
    const modelOutput = await callModel(messages);
    parsed = GeneratedContentSchema.parse(modelOutput);
  } catch (err) {
    summary.push(
      `- **${slug}**: ⚠️ source docs changed but generation/validation failed — left as-is (${err.message})`
    );
    return;
  }

  const docsByUrl = new Map(docs.map((d) => [d.url, d.text]));
  const problems = verifyGrounding(parsed, docsByUrl);
  if (problems.length > 0) {
    summary.push(
      `- **${slug}**: ⚠️ source docs changed but the grounding check failed — left as-is\n  - ${problems.join(
        "\n  - "
      )}`
    );
    return;
  }

  const { data: oldData } = matter(rawFile);
  const oldBlurbLen = (oldData.blurb || "").length;
  if (Math.abs(parsed.blurb.length - oldBlurbLen) > MAX_BLURB_LENGTH_DRIFT) {
    summary.push(
      `- **${slug}**: ⚠️ generated blurb length changed too drastically (${oldBlurbLen} → ${parsed.blurb.length} chars) — left as-is, needs a human look`
    );
    return;
  }

  const updatedFile = applyChangesSurgically(rawFile, parsed, config.docs);

  // Belt-and-braces: make sure what we're about to write still parses into a
  // shape Astro's content-collection schema would accept, before touching disk.
  matter(updatedFile);

  await writeFile(filePath, updatedFile, "utf8");
  summary.push(
    `- **${slug}**: ✅ updated (blurb, solutionPoints, faq, diveDeeper.docs) from ${docs.length} source doc(s), ${parsed.citations.length} citation(s) verified against live docs`
  );
}

async function appendToLocalChangelog(runDateIso, summaryLines) {
  const header = "# docs-sync run log\n\nLocal record of every docs-sync run, newest first. Not part of the Astro site build (lives under scripts/docs-sync/, outside src/content and public/) — this is for your own reference, not published.\n\n";
  let existing = "";
  try {
    existing = await readFile(CHANGELOG_PATH, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  const body = existing.startsWith(header) ? existing.slice(header.length) : existing;
  const entry = `## ${runDateIso}\n\n${summaryLines.join("\n")}\n\n---\n\n`;
  await writeFile(CHANGELOG_PATH, header + entry + body, "utf8");
}

async function sendNotificationEmail(runDateIso, hadChanges, hadWarnings, bodyMarkdown) {
  if (!EMAIL_API_TOKEN || !NOTIFY_EMAIL_TO) {
    console.log("Skipping notification email (EMAIL_API_TOKEN or NOTIFY_EMAIL_TO not set).");
    return;
  }
  const status = hadWarnings ? "needs a look" : hadChanges ? "updated" : "no changes";
  const subject = `Docs sync (${runDateIso}): ${status}`;
  const html = `<div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; white-space: pre-wrap;">${bodyMarkdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</div>`;

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/email/sending/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${EMAIL_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: NOTIFY_EMAIL_TO,
          from: { address: NOTIFY_EMAIL_FROM, name: "Cloudflare Demo Shop docs-sync" },
          subject,
          html,
          text: bodyMarkdown,
        }),
      }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      console.error("Notification email failed:", data?.errors || res.status);
    } else {
      console.log(`Notification email sent to ${NOTIFY_EMAIL_TO}.`);
    }
  } catch (err) {
    console.error("Notification email failed:", err.message);
  }
}

async function main() {
  const sources = await loadJson(CONTENT_SOURCES_PATH, { solutions: {} });
  const state = await loadJson(STATE_PATH, {
    docs: {},
    lastChangelogCheck: null,
    lastBlogCheck: null,
  });

  const slugs = TARGET_SLUGS.length > 0 ? TARGET_SLUGS : Object.keys(sources.solutions);

  const changelogItems = await fetchRssItems(CHANGELOG_RSS_URL);
  const summary = [];
  const changelogNotes = [];
  const blogNotes = [];

  for (const slug of slugs) {
    const config = sources.solutions[slug];
    if (!config) {
      summary.push(`- **${slug}**: skipped — not present in content-sources.json`);
      continue;
    }
    const related = matchChangelogItems(changelogItems, state.lastChangelogCheck, config.productNames).slice(
      0,
      MAX_CHANGELOG_NOTES_PER_SLUG
    );
    for (const item of related) {
      changelogNotes.push(`- [${item.title}](${item.link}) — related to \`${slug}\``);
    }

    const newBlogPosts = (await fetchNewBlogPosts(config.blogTag, state.lastBlogCheck)).slice(
      0,
      MAX_BLOG_NOTES_PER_SLUG
    );
    for (const post of newBlogPosts) {
      blogNotes.push(`- [${post.title}](${post.link}) — tagged "${config.blogTag.label}", relevant to \`${slug}\``);
    }

    await processSlug(slug, config, state, summary);
  }

  const runDateIso = new Date().toISOString();
  state.lastChangelogCheck = runDateIso;
  state.lastBlogCheck = runDateIso;
  await mkdir(path.dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");

  const hadChanges = summary.some((line) => line.includes("✅"));
  const hadWarnings = summary.some((line) => line.includes("⚠️"));

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
    "_Generated copy is only accepted when every non-obvious claim is backed by a verbatim quote from the cited developers.cloudflare.com page (see `verifyGrounding` in `scripts/docs-sync/sync-docs.mjs`). Anything that fails that check, or drifts too far in length from the current copy, is left untouched and flagged above for manual review instead of being force-applied._"
  );

  const summaryText = lines.join("\n") + "\n";
  await writeFile(SUMMARY_PATH, summaryText, "utf8");
  console.log(summaryText);

  // Only add a CHANGELOG.md entry (and therefore a commit) when there's
  // something worth recording — keeps the local log signal, not a rubber
  // stamp every Monday. The email still goes out every run regardless, per
  // "let me know what updated if anything."
  const worthRecording = hadChanges || hadWarnings || changelogNotes.length > 0 || blogNotes.length > 0;
  if (worthRecording) {
    await appendToLocalChangelog(runDateIso, lines);
  }

  await sendNotificationEmail(runDateIso, hadChanges, hadWarnings, summaryText);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
