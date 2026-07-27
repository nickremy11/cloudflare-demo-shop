// Minimal, hand-rolled YAML frontmatter surgery for the docs-sync Worker.
//
// Why not a generic YAML dumper? Re-serializing the *entire* frontmatter
// object rewrites every field's quoting/line-wrapping style, producing a
// huge, unreviewable diff even when only one field actually changed.
// Content in src/content/solutions/*.md is hand authored with a consistent
// double-quoted, unwrapped style — this module edits only the specific
// top-level blocks the sync actually changed (`blurb`, `solutionPoints`,
// `faq`, `diveDeeper.docs`, `lastVerified`, `sources`) and leaves every other
// byte of the file untouched.
//
// `src/content/config.ts` (the Zod schema, in the main site) remains the
// source of truth for what a valid file looks like — this module only has to
// produce YAML text that parses back into an equivalent object, not
// implement YAML in general.

const TOP_LEVEL_KEY_RE = /^[A-Za-z_][\w]*:/;

export interface Block {
  key: string;
  lines: string[];
}

export function escapeYamlDouble(str: string): string {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, "\\n");
}

export function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("File does not start with a YAML frontmatter block (--- ... ---)");
  }
  return { frontmatter: match[1], body: match[2] ?? "" };
}

// Groups frontmatter lines into one block per top-level key. Any blank/indented
// lines that follow a key (including blank separator lines before the *next*
// key) are considered part of that key's block — this is what lets us restore
// the exact same blank-line spacing after editing a block in place.
export function parseBlocks(frontmatterText: string): Block[] {
  const lines = frontmatterText.split(/\r?\n/);
  const blocks: Block[] = [];
  let current: Block | null = null;
  for (const line of lines) {
    if (TOP_LEVEL_KEY_RE.test(line)) {
      if (current) blocks.push(current);
      current = { key: line.slice(0, line.indexOf(":")), lines: [line] };
    } else {
      if (!current) current = { key: "__preamble__", lines: [] };
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

export function stringifyBlocks(blocks: Block[]): string {
  return blocks.flatMap((b) => b.lines).join("\n");
}

export function findBlock(blocks: Block[], key: string): Block | undefined {
  return blocks.find((b) => b.key === key);
}

function countTrailingBlankLines(lines: string[]): number {
  let n = 0;
  for (let i = lines.length - 1; i >= 0 && lines[i].trim() === ""; i--) n++;
  return n;
}

// Replaces a block's content while preserving however many trailing blank
// lines it originally had (the separator before the next section).
function setBlockContent(block: Block, contentLines: string[]): void {
  const trailing = countTrailingBlankLines(block.lines);
  block.lines = [...contentLines, ...Array(trailing).fill("")];
}

export function upsertScalarBlock(blocks: Block[], key: string, value: string): void {
  const line = `${key}: "${escapeYamlDouble(value)}"`;
  const existing = findBlock(blocks, key);
  if (existing) setBlockContent(existing, [line]);
  else blocks.push({ key, lines: [line] });
}

export function upsertStringListBlock(blocks: Block[], key: string, values: string[]): void {
  const lines = [`${key}:`, ...values.map((v) => `  - "${escapeYamlDouble(v)}"`)];
  const existing = findBlock(blocks, key);
  if (existing) setBlockContent(existing, lines);
  else blocks.push({ key, lines });
}

// Renders `key:\n  - <fieldA>: "..."\n    <fieldB>: "..."` — the shape shared
// by `solutionPoints` (title/detail) and `faq` (question/answer).
export function setTwoFieldListBlock(
  block: Block,
  items: Record<string, string>[],
  fieldA: string,
  fieldB: string
): void {
  const lines = [`${block.key}:`];
  for (const item of items) {
    lines.push(`  - ${fieldA}: "${escapeYamlDouble(item[fieldA])}"`);
    lines.push(`    ${fieldB}: "${escapeYamlDouble(item[fieldB])}"`);
  }
  setBlockContent(block, lines);
}

// `diveDeeper:` nests both `docs:` (regenerated) and `blogs:`/`blogTag:` (left
// untouched — manually curated). Finds the `  docs:` sub-block by indentation
// and swaps only that span.
export function replaceDiveDeeperDocs(
  block: Block,
  newDocs: { title: string; url: string }[]
): void {
  const lines = block.lines;
  const out: string[] = [];
  let i = 0;
  while (i < lines.length && !/^ {2}docs:\s*$/.test(lines[i])) {
    out.push(lines[i]);
    i++;
  }
  if (i >= lines.length) {
    throw new Error('diveDeeper block has no "  docs:" key to replace');
  }
  i++; // skip the old "  docs:" line itself — we emit a fresh one below
  while (i < lines.length && !/^ {2}[A-Za-z_]/.test(lines[i])) {
    i++; // skip old doc list items until the next 2-space-indented key (blogs:) or EOF
  }
  out.push("  docs:");
  for (const d of newDocs) {
    out.push(`    - title: "${escapeYamlDouble(d.title)}"`);
    out.push(`      url: "${escapeYamlDouble(d.url)}"`);
  }
  out.push(...lines.slice(i));
  block.lines = out;
}
