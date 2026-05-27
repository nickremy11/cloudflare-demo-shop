// /functions/api/[[path]].ts
// Single Hono app handling all API routes for Cloudflare Demo Shop.
// Replaces: waf-test, rate-limit-test, debug-headers, auth/whoami,
//           r2/list, r2/upload, r2/download/:fileId, r2/delete/:fileId

import { Hono, Context, Next } from "hono";
import { cors } from "hono/cors";

// ── Types ─────────────────────────────────────────────────────

type Bindings = {
  STORAGE_BUCKET: R2Bucket;
  DEMO_KV: KVNamespace;
  AI: Ai;
  AIG_TOKEN: string;
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

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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

// ── Middleware ────────────────────────────────────────────────

// CORS applied once for every route
app.use("*", cors({ origin: "*" }));

// Inspector: builds the shared request-inspector payload used by WAF demo
app.use("*", async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
  c.set("inspector", {
    request: {
      method: c.req.method,
      url: c.req.url,
      headers: Object.fromEntries(
        INSPECT_KEYS.map((k) => [k, c.req.header(k)])
      ),
    },
  });
  await next();
});

// Auth helper: tries all Access header variants, sets userEmail on success
const requireAccessAuth = async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
  const userEmail = ACCESS_HEADER_VARIANTS
    .map((h) => c.req.header(h))
    .find((v) => !!v);

  if (!userEmail) {
    return c.json(
      {
        authenticated: false,
        error: "No authenticated user found",
        debug: { headers: Object.fromEntries(c.req.raw.headers) },
      },
      401
    );
  }

  c.set("userEmail", userEmail);
  await next();
};

// ── WAF Test ──────────────────────────────────────────────────
// GET /api/waf-test?attack=sqli|xss|cmdi|header

app.get("/api/waf-test", (c) => {
  const attack = c.req.query("attack");
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
});

// ── Rate Limiting ─────────────────────────────────────────────
// GET /api/rate-limit-test

app.get("/api/rate-limit-test", (c) => {
  return c.json({
    status: "allowed",
    message: "Request successful.",
    timestamp: Date.now(),
  });
});

// ── Debug Headers ─────────────────────────────────────────────
// GET /api/debug-headers

app.get("/api/debug-headers", (c) => {
  const headers: Record<string, string> = {};
  for (const [key, value] of c.req.raw.headers.entries()) {
    headers[key] = value;
  }
  return c.json({
    message: "Debug headers endpoint",
    headers,
    accessHeaders: {
      "cf-access-authenticated-user-email": c.req.header("cf-access-authenticated-user-email"),
      "Cf-Access-Authenticated-User-Email": c.req.header("Cf-Access-Authenticated-User-Email"),
      "CF-Access-Authenticated-User-Email": c.req.header("CF-Access-Authenticated-User-Email"),
      "x-forwarded-user": c.req.header("x-forwarded-user"),
    },
    url: c.req.url,
    method: c.req.method,
  });
});

// ── Auth / Whoami ─────────────────────────────────────────────
// GET /api/auth/whoami

app.get("/api/auth/whoami", requireAccessAuth, (c) => {
  return c.json({
    authenticated: true,
    email: c.get("userEmail"),
    timestamp: Date.now(),
  });
});

// ── R2: List Files ────────────────────────────────────────────
// GET /api/r2/list

interface FileMetadata {
  fileId: string;
  uploadedBy: string;
  uploadedAt: number;
  originalName: string;
  size: number;
  contentType: string;
  r2Key: string;
  scanStatus: "pending" | "clean" | "malicious";
}

interface FileWithTier extends FileMetadata {
  tier: "standard" | "infrequent";
}

app.get("/api/r2/list", requireAccessAuth, async (c) => {
  try {
    const userEmail = c.get("userEmail");
    const userFilesKey = `user_files:${userEmail}`;
    const userFilesJson = await c.env.DEMO_KV.get(userFilesKey);

    if (!userFilesJson) {
      return c.json({ files: [], count: 0, userEmail });
    }

    const fileIds: string[] = JSON.parse(userFilesJson);
    const files: FileWithTier[] = [];

    for (const fileId of fileIds) {
      const metadataJson = await c.env.DEMO_KV.get(`file:${fileId}`);
      if (metadataJson) {
        const metadata: FileMetadata = JSON.parse(metadataJson);
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const fileAge = Date.now() - metadata.uploadedAt;
        const tier: "standard" | "infrequent" =
          fileAge > thirtyDaysMs ? "infrequent" : "standard";
        files.push({ ...metadata, tier });
      }
    }

    files.sort((a, b) => b.uploadedAt - a.uploadedAt);
    return c.json({ files, count: files.length, userEmail });
  } catch (error: any) {
    console.error("List files error:", error);
    return c.json({ error: "Failed to list files: " + error.message }, 500);
  }
});

// ── R2: Upload ────────────────────────────────────────────────
// POST /api/r2/upload
// NOTE: Approved emails now checked via KV instead of hardcoded list

app.post("/api/r2/upload", requireAccessAuth, async (c) => {
  try {
    const userEmail = c.get("userEmail");

    // Verify email is in approved list (stored in KV)
    const approvedEmailsJson = await c.env.DEMO_KV.get("approved_emails");
    const approvedEmails: string[] = approvedEmailsJson ? JSON.parse(approvedEmailsJson) : [];
    
    if (!approvedEmails.includes(userEmail)) {
      return c.json({ error: "Forbidden - Email not in approved customer list" }, 403);
    }

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return c.json({ error: "Invalid file type. Only PDF, JPG, and PNG files are allowed." }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: "File too large. Maximum size is 5MB." }, 400);
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileId = `${timestamp}_${randomId}`;
    const r2Key = `${timestamp}_${randomId}_${sanitizeFilename(file.name)}`;

    const metadata: FileMetadata = {
      fileId,
      uploadedBy: userEmail,
      uploadedAt: timestamp,
      originalName: file.name,
      size: file.size,
      contentType: file.type,
      r2Key,
      scanStatus: "clean",
    };

    const arrayBuffer = await file.arrayBuffer();
    await c.env.STORAGE_BUCKET.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        contentDisposition: `attachment; filename="${file.name}"`,
      },
      customMetadata: {
        uploadedBy: userEmail,
        originalName: file.name,
        fileId,
      },
    });

    await c.env.DEMO_KV.put(`file:${fileId}`, JSON.stringify(metadata));

    const userFilesKey = `user_files:${userEmail}`;
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
      message: "File uploaded successfully",
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return c.json({ error: "Upload failed: " + error.message }, 500);
  }
});

// ── R2: Download ──────────────────────────────────────────────
// GET /api/r2/download/:fileId

app.get("/api/r2/download/:fileId", requireAccessAuth, async (c) => {
  try {
    const fileId = c.req.param("fileId");
    const userEmail = c.get("userEmail");

    const metadataJson = await c.env.DEMO_KV.get(`file:${fileId}`);
    if (!metadataJson) {
      return c.json({ error: "File not found" }, 404);
    }

    const metadata: FileMetadata = JSON.parse(metadataJson);

    if (metadata.uploadedBy !== userEmail) {
      return c.json({ error: "Forbidden - You can only download files you uploaded" }, 403);
    }

    if (metadata.scanStatus === "malicious") {
      return c.json({ error: "File blocked - Malicious content detected" }, 403);
    }

    const object = await c.env.STORAGE_BUCKET.get(metadata.r2Key);
    if (!object) {
      return c.json({ error: "File not found in storage" }, 404);
    }

    return new Response(object.body, {
      headers: {
        "Content-Type": metadata.contentType,
        "Content-Disposition": `attachment; filename="${metadata.originalName}"`,
        "Content-Length": object.size.toString(),
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error: any) {
    console.error("Download error:", error);
    return c.json({ error: "Failed to download file: " + error.message }, 500);
  }
});

// ── R2: Delete ────────────────────────────────────────────────
// DELETE /api/r2/delete/:fileId

app.delete("/api/r2/delete/:fileId", requireAccessAuth, async (c) => {
  try {
    const fileId = c.req.param("fileId");
    const userEmail = c.get("userEmail");

    const metadataJson = await c.env.DEMO_KV.get(`file:${fileId}`);
    if (!metadataJson) {
      return c.json({ error: "File not found" }, 404);
    }

    const metadata: FileMetadata = JSON.parse(metadataJson);

    if (metadata.uploadedBy !== userEmail) {
      return c.json({ error: "Forbidden - You can only delete files you uploaded" }, 403);
    }

    await c.env.STORAGE_BUCKET.delete(metadata.r2Key);
    await c.env.DEMO_KV.delete(`file:${fileId}`);

    const userFilesKey = `user_files:${userEmail}`;
    const userFilesJson = await c.env.DEMO_KV.get(userFilesKey);
    if (userFilesJson) {
      const userFiles: string[] = JSON.parse(userFilesJson);
      const updatedFiles = userFiles.filter((id) => id !== fileId);
      if (updatedFiles.length > 0) {
        await c.env.DEMO_KV.put(userFilesKey, JSON.stringify(updatedFiles));
      } else {
        await c.env.DEMO_KV.delete(userFilesKey);
      }
    }

    return c.json({
      success: true,
      fileId,
      filename: metadata.originalName,
      message: "File deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete error:", error);
    return c.json({ error: "Failed to delete file: " + error.message }, 500);
  }
});

// ── AI Chatbot ────────────────────────────────────────────
// POST /api/chat

app.post("/api/chat", async (c) => {
  try {
    const { messages } = await c.req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: "Messages array required" }, 400);
    }

    console.log("Chat request received with", messages.length, "messages");

    const systemPrompt = `You are a helpful assistant for the Cloudflare Demo Shop at remydemo.com. You help users find demos and answer Cloudflare product questions.

Available demos on this site:

SASE / Workspace Security:
- Zero Trust Access: /demos/zero-trust.html
- Secure Web Gateway: /demos/swg.html
- Email Security: /demos/email-security.html
- Browser Isolation: /demos/browser-isolation.html

App Security & Performance:
- WAF / L7 Attacks: /demos/waf-attacks.html (interactive - try SQL injection, XSS, etc.)
- DDoS Protection: /demos/ddos.html
- Bot Management: /demos/bot-management.html
- Rate Limiting: /demos/rate-limiting.html
- CDN & DNS: /demos/cdn-dns.html

Developer Platform:
- Workers: /demos/workers.html
- Pages: /demos/pages.html
- Storage Solutions: /demos/storage-r2.html (interactive - upload files to R2)

Network Services:
- Magic Transit: /demos/magic-transit.html
- Load Balancing: /demos/load-balancing.html

When users ask about security demos, performance, storage, or networking, suggest the relevant interactive demo page. Answer Cloudflare product questions accurately based on your knowledge. Keep responses concise and helpful.`;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/e2e9b1cd0acebaaf2aee23d918eee2b1/ai/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${c.env.AIG_TOKEN}`,
          "cf-aig-gateway-id": "demo-shop-gateway",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "@cf/meta/llama-3.1-8b-instruct",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: false,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error - Status:", response.status, "Body:", errorText);
      return c.json({ error: "AI request failed", status: response.status, details: errorText }, 500);
    }

    const result = await response.json();
    console.log("AI Gateway response received:", JSON.stringify(result).substring(0, 200));
    return c.json(result);
  } catch (error: any) {
    console.error("Chat error:", error);
    return c.json({ error: "Chat failed: " + error.message }, 500);
  }
});

// ── Helpers ───────────────────────────────────────────────────

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
}

// ── Pages Functions export ────────────────────────────────────

export const onRequest = (context: { request: Request; env: Bindings }) => {
  return app.fetch(context.request, context.env, context);
};