// /functions/api/[[path]].ts
// Single Hono app handling all API routes for the Cloudflare Demo Shop.
//
// Routes (v2 — Astro rebuild):
//   GET  /api/waf/testattack?type=sqli|xss|cmdi|header  — WAF attack target
//   GET  /api/rate-limit-test                            — Rate-limit target
//   GET  /api/debug-headers                              — Header dump
//   GET  /api/auth/whoami                                — Access JWT check
//   POST /api/r2/upload                                  — Upload (Access OR guest+email)
//   GET  /api/r2/list                                    — List my files (Access)
//   GET  /api/r2/download/:fileId                        — Download (Access)
//   DELETE /api/r2/delete/:fileId                        — Delete (Access)
//   GET  /api/diagrams/list                              — List diagrams (R2)
//   PUT  /api/diagrams/:name/tags                        — Set tags (KV)
//   GET  /api/diagrams/:name                             — Stream diagram (cached)
//   POST /api/cache/purge                                — Real CF Cache Purge API call
//   POST /api/turnstile/verify                           — siteverify call
//   POST /api/chat                                       — AI Gateway → Llama 3.3 70B
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
  AI: Ai;
  AIG_TOKEN: string;
  CF_ZONE_ID?: string;
  CF_CACHE_PURGE_TOKEN?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_SITE_KEY?: string;
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

// ── Auth / whoami ─────────────────────────────────────────────

app.get("/api/auth/whoami", requireAccessAuth, (c) => {
  return c.json({
    authenticated: true,
    email: c.get("userEmail"),
    timestamp: Date.now(),
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
// Supports BOTH:
//   - Authenticated upload via Cloudflare Access (uses signed-in email)
//   - Guest upload (form field 'guestEmail' provides the attribution email)

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
        { error: "Must be signed in via Cloudflare Access OR provide a valid guestEmail." },
        401
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

    await c.env.DEMO_KV.put(`file:${fileId}`, JSON.stringify(metadata));

    const userFilesKey = `user_files:${identity.email}`;
    const existingFilesJson = await c.env.DEMO_KV.get(userFilesKey);
    const existingFiles: string[] = existingFilesJson ? JSON.parse(existingFilesJson) : [];
    existingFiles.push(fileId);
    await c.env.DEMO_KV.put(userFilesKey, JSON.stringify(existingFiles));

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

// ── R2: List Files (Access only — guest uploads are write-only) ───

app.get("/api/r2/list", requireAccessAuth, async (c) => {
  try {
    const userEmail = c.get("userEmail");
    const userFilesKey = `user_files:${userEmail}`;
    const userFilesJson = await c.env.DEMO_KV.get(userFilesKey);
    if (!userFilesJson) return c.json({ files: [], count: 0, userEmail });

    const fileIds: string[] = JSON.parse(userFilesJson);
    const files: FileWithTier[] = [];
    for (const fileId of fileIds) {
      const metadataJson = await c.env.DEMO_KV.get(`file:${fileId}`);
      if (metadataJson) {
        const metadata: FileMetadata = JSON.parse(metadataJson);
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const fileAge = Date.now() - metadata.uploadedAt;
        const tier: "standard" | "infrequent" = fileAge > thirtyDaysMs ? "infrequent" : "standard";
        files.push({ ...metadata, tier });
      }
    }
    files.sort((a, b) => b.uploadedAt - a.uploadedAt);
    return c.json({ files, count: files.length, userEmail });
  } catch (error: any) {
    return c.json({ error: "Failed to list files: " + error.message }, 500);
  }
});

// ── R2: Download / Delete (Access only) ──────────────────────

app.get("/api/r2/download/:fileId", requireAccessAuth, async (c) => {
  try {
    const fileId = c.req.param("fileId");
    const userEmail = c.get("userEmail");
    const metadataJson = await c.env.DEMO_KV.get(`file:${fileId}`);
    if (!metadataJson) return c.json({ error: "File not found" }, 404);
    const metadata: FileMetadata = JSON.parse(metadataJson);
    if (metadata.uploadedBy !== userEmail) {
      return c.json({ error: "Forbidden — file belongs to another user" }, 403);
    }
    if (metadata.scanStatus === "malicious") {
      return c.json({ error: "File blocked — malicious content detected" }, 403);
    }
    const object = await c.env.STORAGE_BUCKET.get(metadata.r2Key);
    if (!object) return c.json({ error: "File not found in storage" }, 404);
    return new Response(object.body, {
      headers: {
        "Content-Type": metadata.contentType,
        "Content-Disposition": `attachment; filename="${metadata.originalName}"`,
        "Content-Length": object.size.toString(),
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error: any) {
    return c.json({ error: "Download failed: " + error.message }, 500);
  }
});

app.delete("/api/r2/delete/:fileId", requireAccessAuth, async (c) => {
  try {
    const fileId = c.req.param("fileId");
    const userEmail = c.get("userEmail");
    const metadataJson = await c.env.DEMO_KV.get(`file:${fileId}`);
    if (!metadataJson) return c.json({ error: "File not found" }, 404);
    const metadata: FileMetadata = JSON.parse(metadataJson);
    if (metadata.uploadedBy !== userEmail) {
      return c.json({ error: "Forbidden — file belongs to another user" }, 403);
    }
    await c.env.STORAGE_BUCKET.delete(metadata.r2Key);
    await c.env.DEMO_KV.delete(`file:${fileId}`);

    const userFilesKey = `user_files:${userEmail}`;
    const userFilesJson = await c.env.DEMO_KV.get(userFilesKey);
    if (userFilesJson) {
      const userFiles: string[] = JSON.parse(userFilesJson);
      const remaining = userFiles.filter((id) => id !== fileId);
      if (remaining.length > 0) {
        await c.env.DEMO_KV.put(userFilesKey, JSON.stringify(remaining));
      } else {
        await c.env.DEMO_KV.delete(userFilesKey);
      }
    }

    return c.json({ success: true, fileId, filename: metadata.originalName });
  } catch (error: any) {
    return c.json({ error: "Delete failed: " + error.message }, 500);
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
// Cloudflare's test secret keys (PUBLIC):
//   1x0000000000000000000000000000000AA — always passes
//   2x0000000000000000000000000000000AA — always fails
// In production, set TURNSTILE_SECRET to your real widget secret.

// Exposes the public site key to the client-side demo. The site key is public
// (always visible in HTML), but routing through here lets us swap it via
// wrangler.toml [vars] without rebuilding the Astro component.
app.get("/api/turnstile/config", (c) => {
  return c.json({
    siteKey: c.env.TURNSTILE_SITE_KEY || "1x00000000000000000000AA",
    usingTestKey: !c.env.TURNSTILE_SITE_KEY,
  });
});

app.post("/api/turnstile/verify", async (c) => {
  try {
    const { token } = await c.req.json();
    if (!token) return c.json({ success: false, error: "Missing token" }, 400);

    // Default to test secret if not configured
    const secret = c.env.TURNSTILE_SECRET || "1x0000000000000000000000000000000AA";
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
      siteverify: data,
      usingTestSecret: !c.env.TURNSTILE_SECRET,
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

// ── Pages Functions export ───────────────────────────────────

export const onRequest = (context: { request: Request; env: Bindings }) => {
  return app.fetch(context.request, context.env, context);
};
