# Cloudflare Demo Shop

An interactive demo site showcasing Cloudflare's products across four pillars:

- **SASE / Workspace Security** — Zero Trust Access, SWG, Email Security, Browser Isolation
- **App Security & Performance** — WAF/L7, DDoS, Bot Management, Rate Limiting, CDN & DNS
- **Developer Platform** — Workers, Pages, Storage Solutions
- **Network Services** — Magic Transit, Load Balancing

Hosted on **Cloudflare Pages** with **Pages Functions** (Workers) powering interactive demos.

---

## Local Development

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### Setup

```bash
# Install dependencies
npm install

# Run locally (live reload)
npm run dev
```

Then open `http://localhost:8788` in your browser.

---

## Deployment

This repo is connected to Cloudflare Pages via GitHub integration.
Push to `main` → auto-deploys.

### Manual deploy (if needed)
```bash
npm run deploy
```

---

## File Naming Conventions

### Adding a Diagram
Drop PNG files into `/demos/` using this naming pattern:
```
/demos/{feature}-diagram.png
```

Examples:
```
/demos/waf-attacks-diagram.png
/demos/zero-trust-diagram.png
/demos/cdn-dns-diagram.png
```

The "View Diagram" button on the landing page links directly to these files.

### Adding a Demo Page
Create an HTML file in `/demos/` using this naming pattern:
```
/demos/{feature}.html
```

Examples:
```
/demos/waf-attacks.html
/demos/rate-limiting.html
/demos/workers.html
```

Use the shared CSS classes in `/public/styles/main.css` for consistent styling
(`.btn-primary`, `.btn-secondary`, `.demo-panel`, `.demo-input`, `.code-output`).

---

## Feature List & File Names

| Feature | Demo Page | Diagram |
|---|---|---|
| **SASE / Workspace Security** | | |
| Zero Trust Access | `/demos/zero-trust.html` | `/demos/zero-trust-diagram.png` |
| Secure Web Gateway | `/demos/swg.html` | `/demos/swg-diagram.png` |
| Email Security | `/demos/email-security.html` | `/demos/email-security-diagram.png` |
| Browser Isolation | `/demos/browser-isolation.html` | `/demos/browser-isolation-diagram.png` |
| **App Security & Performance** | | |
| WAF / L7 Attacks | `/demos/waf-attacks.html` | `/demos/waf-attacks-diagram.png` |
| DDoS Protection | `/demos/ddos.html` | `/demos/ddos-diagram.png` |
| Bot Management | `/demos/bot-management.html` | `/demos/bot-management-diagram.png` |
| Rate Limiting | `/demos/rate-limiting.html` | `/demos/rate-limiting-diagram.png` |
| CDN & DNS | `/demos/cdn-dns.html` | `/demos/cdn-dns-diagram.png` |
| **Developer Platform** | | |
| Workers | `/demos/workers.html` | `/demos/workers-diagram.png` |
| Pages | `/demos/pages.html` | `/demos/pages-diagram.png` |
| Storage Solutions | `/demos/storage.html` | `/demos/storage-diagram.png` |
| **Network Services** | | |
| Magic Transit | `/demos/magic-transit.html` | `/demos/magic-transit-diagram.png` |
| Load Balancing | `/demos/load-balancing.html` | `/demos/load-balancing-diagram.png` |

---

## Custom Domain (Future)

When ready to move from `*.pages.dev` to `remydemo.com`:

1. Add `remydemo.com` to your Cloudflare account (zone)
2. In Pages project settings → Custom Domains → Add `home.remydemo.com`
3. Cloudflare will automatically handle DNS + SSL
