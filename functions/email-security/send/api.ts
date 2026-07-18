// /functions/email-security/send/api.ts
//
// Access-protected Email Sending demo endpoint.
//
// remydemo.com/email-security/send* is covered by a Cloudflare Access
// self-hosted application, so Access intercepts every request to this
// path at the edge and requires a signed-in identity before it ever
// reaches this Function — an unauthenticated visitor never gets here.
//
// We STILL independently verify the Cf-Access-Jwt-Assertion token below.
// Access applications are scoped to a specific hostname, and this Pages
// project is also reachable on its *.pages.dev fallback domain, which the
// Access application does NOT cover. A request that reaches this Function
// via *.pages.dev would otherwise sail straight through with zero
// verification — trusting the Cf-Access-Authenticated-User-Email header
// alone would let anyone set it themselves on that hostname. Verifying the
// signed JWT (signature + issuer + audience + expiry) means the send only
// ever runs for a request Access has actually vetted, regardless of which
// hostname it arrived on.
//
// GET  /email-security/send/api  -> { authenticated: true, email } or 401
// POST /email-security/send/api  -> sends the fixed demo email, body:
//                                    { to: string } — any recipient the
//                                    signed-in visitor enters.

type Env = {
  CF_ACCOUNT_ID?: string;
  EMAIL_API_TOKEN?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  DEMO_KV?: KVNamespace;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEMO_EMAIL_HTML = `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h2 style="color: #0d3b34;">Thanks for reaching out</h2>
    <p>This is a demo message sent with <strong>Cloudflare Email Sending</strong>
    from <code>support@remydemo.com</code>, triggered by a visitor who signed
    in with <strong>Cloudflare Access</strong> first.</p>
    <p>Reply to this email and <strong>Cloudflare Email Routing</strong> will
    forward your reply to our support inbox — no mail server required.</p>
    <p style="color: #6b7280; font-size: 13px;">— Cloudflare Demo Shop</p>
  </div>
`;

const DEMO_EMAIL_TEXT =
  "Thanks for reaching out.\n\n" +
  "This is a demo message sent with Cloudflare Email Sending from support@remydemo.com, " +
  "triggered by a visitor who signed in with Cloudflare Access first.\n\n" +
  "Reply to this email and Cloudflare Email Routing will forward your reply to our " +
  "support inbox — no mail server required.\n\n" +
  "— Cloudflare Demo Shop";

// ── Cloudflare Access JWT verification ─────────────────────────

let jwksCache: { keys: any[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 10 * 60 * 1000;

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

async function getJwks(teamDomain: string): Promise<any[]> {
  const now = Date.now();
  if (jwksCache && now - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  const res = await fetch(`${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Failed to fetch Access JWKS (${res.status})`);
  const data: any = await res.json();
  const keys = Array.isArray(data.keys) ? data.keys : [];
  jwksCache = { keys, fetchedAt: now };
  return keys;
}

async function verifyAccessJwt(
  token: string,
  teamDomain: string,
  aud: string
): Promise<{ email: string } | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: any, payload: any;
  try {
    header = JSON.parse(base64UrlDecode(headerB64));
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return null;
  }
  if (!header.kid || !header.alg) return null;

  const keys = await getJwks(teamDomain);
  const key = keys.find((k: any) => k.kid === header.kid);
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
  const isValid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature, data);
  if (!isValid) return null;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) return null;
  if (typeof payload.nbf === "number" && payload.nbf > now) return null;
  if (payload.iss !== teamDomain) return null;

  const audClaim: string[] = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audClaim.includes(aud)) return null;

  const email = payload.email || payload.custom?.email;
  return email ? { email } : null;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function requireAccess(request: Request, env: Env): Promise<{ email: string } | Response> {
  if (!env.ACCESS_AUD) {
    return json(
      { error: "Access is not configured on the server (missing ACCESS_AUD)." },
      500
    );
  }
  const teamDomain = env.ACCESS_TEAM_DOMAIN || "https://cf-remydemo.cloudflareaccess.com";
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) {
    return json({ error: "Sign in with Cloudflare Access to use this demo." }, 401);
  }

  let identity: { email: string } | null;
  try {
    identity = await verifyAccessJwt(token, teamDomain, env.ACCESS_AUD);
  } catch (err: any) {
    return json({ error: "Failed to verify Access session: " + err.message }, 500);
  }

  if (!identity) {
    return json(
      { error: "Your Access session is invalid or has expired. Refresh the page to sign in again." },
      401
    );
  }

  return identity;
}

// ── Lightweight per-identity cooldown ──────────────────────────
// Access already decides *who* can call this endpoint; this just stops one
// signed-in identity from looping the button. Best-effort only (KV reads
// are eventually consistent) — a courtesy limit, not the security boundary.

const COOLDOWN_MAX = 5;
const COOLDOWN_WINDOW_SECONDS = 600; // 10 minutes

async function checkCooldown(kv: KVNamespace | undefined, email: string): Promise<boolean> {
  if (!kv) return true; // no KV bound — skip silently
  const key = `email-security:send:cooldown:${email.toLowerCase()}`;
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) || 0 : 0;
  if (count >= COOLDOWN_MAX) return false;
  await kv.put(key, String(count + 1), { expirationTtl: COOLDOWN_WINDOW_SECONDS });
  return true;
}

// ── Handlers ──────────────────────────────────────────────────

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const result = await requireAccess(request, env);
  if (result instanceof Response) return result;
  return json({ authenticated: true, email: result.email });
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const result = await requireAccess(request, env);
  if (result instanceof Response) return result;
  const { email } = result;

  try {
    const allowed = await checkCooldown(env.DEMO_KV, email);
    if (!allowed) {
      return json(
        { error: `Too many sends from ${email} in the last 10 minutes. Try again shortly.` },
        429
      );
    }

    const body = (await request.json().catch(() => null)) as any;
    const rawTo = typeof body?.to === "string" ? body.to.trim() : "";

    if (!rawTo) {
      return json({ error: "Enter an email address to send to." }, 400);
    }
    if (rawTo.length > 254 || /[,;\r\n]/.test(rawTo) || !EMAIL_RE.test(rawTo)) {
      return json({ error: "Enter a single, valid email address." }, 400);
    }

    if (!env.CF_ACCOUNT_ID || !env.EMAIL_API_TOKEN) {
      return json({ error: "Email Sending is not configured on the server." }, 500);
    }

    const apiRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.EMAIL_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: rawTo,
          from: { address: "support@remydemo.com", name: "Cloudflare Demo Support" },
          subject: "We received your message — Cloudflare Demo Shop",
          html: DEMO_EMAIL_HTML,
          text: DEMO_EMAIL_TEXT,
        }),
      }
    );

    const data: any = await apiRes.json().catch(() => null);

    if (!apiRes.ok || !data?.success) {
      const message = data?.errors?.[0]?.message || "Failed to send email.";
      return json({ error: message }, apiRes.status || 500);
    }

    return json({ success: true, to: rawTo, sentBy: email, result: data.result });
  } catch (error: any) {
    return json({ error: error?.message || "Failed to send email." }, 500);
  }
};
