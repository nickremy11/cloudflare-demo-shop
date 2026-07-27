// Minimal GitHub REST API client used by the docs-sync Worker to read and
// atomically commit files, entirely over fetch() — no git binary, no
// filesystem, no GitHub Actions runner needed. This is the piece that
// replaces `git commit && git push` when the automation runs as a Worker
// instead of a CI job: everything below is just HTTP calls to api.github.com
// using a repo-scoped GitHub token (Worker secret `GITHUB_TOKEN`).
//
// Reads use the simpler Contents API (one file at a time). Writes use the
// lower-level Git Data API (blobs -> tree -> commit -> ref update) so that a
// run touching N files lands as exactly one commit on `main`, atomically —
// the same shape as the single "docs-sync: weekly Cloudflare docs accuracy
// check" commit the previous GitHub Actions version produced.

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

const API = "https://api.github.com";

function headers(token: string, extra?: Record<string, string>) {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "cloudflare-demo-shop-docs-sync-worker",
    ...extra,
  };
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function githubJson(url: string, token: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: { ...headers(token), ...(init?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GitHub API ${init?.method || "GET"} ${url} failed (${res.status}): ${detail.slice(0, 500)}`);
  }
  return res.json();
}

// Reads one file's current content + blob sha via the Contents API. Returns
// null if the file doesn't exist yet (a 404 is a legitimate "not found", not
// an error, for callers like CHANGELOG.md on the very first run).
export async function getFile(
  cfg: GitHubConfig,
  path: string
): Promise<{ content: string; sha: string } | null> {
  const url = `${API}/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(cfg.branch)}`;
  const res = await fetch(url, { headers: headers(cfg.token) });
  if (res.status === 404) return null;
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GitHub getFile(${path}) failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const data: any = await res.json();
  if (Array.isArray(data)) throw new Error(`GitHub getFile(${path}): path is a directory`);
  return { content: base64ToUtf8(data.content), sha: data.sha };
}

// Commits any number of file changes as one atomic commit on cfg.branch,
// using the Git Data API (blob -> tree -> commit -> ref update). Returns the
// new commit sha, or null if there was nothing to commit.
export async function commitFiles(
  cfg: GitHubConfig,
  files: { path: string; content: string }[],
  message: string
): Promise<string | null> {
  if (files.length === 0) return null;

  const refUrl = `${API}/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${cfg.branch}`;
  const ref = await githubJson(refUrl, cfg.token);
  const baseCommitSha: string = ref.object.sha;

  const baseCommit = await githubJson(
    `${API}/repos/${cfg.owner}/${cfg.repo}/git/commits/${baseCommitSha}`,
    cfg.token
  );
  const baseTreeSha: string = baseCommit.tree.sha;

  const treeItems = [];
  for (const file of files) {
    const blob = await githubJson(`${API}/repos/${cfg.owner}/${cfg.repo}/git/blobs`, cfg.token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: utf8ToBase64(file.content), encoding: "base64" }),
    });
    treeItems.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const newTree = await githubJson(`${API}/repos/${cfg.owner}/${cfg.repo}/git/trees`, cfg.token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
  });

  const newCommit = await githubJson(`${API}/repos/${cfg.owner}/${cfg.repo}/git/commits`, cfg.token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, tree: newTree.sha, parents: [baseCommitSha] }),
  });

  // Deliberately no `force: true` — if `main` moved since we read it (a human
  // pushed in the meantime), this fails loudly instead of silently
  // overwriting their commit. Rare at a once-a-week cadence, but worth
  // getting right.
  await githubJson(
    `${API}/repos/${cfg.owner}/${cfg.repo}/git/refs/heads/${cfg.branch}`,
    cfg.token,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: newCommit.sha }),
    }
  );

  return newCommit.sha;
}
