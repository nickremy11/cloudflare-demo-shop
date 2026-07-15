---
title: "Turnstile"
blurb: "A user-friendly, privacy-preserving CAPTCHA replacement. Most users pass invisibly; only suspicious sessions see a challenge. Free, drop-in, and works on any site."
pillar: "app-security"
order: 6

challenge:
  question: "How do you prove a user is human without making them click traffic lights for two minutes?"
  detail: "Traditional CAPTCHAs hurt your conversion rate, annoy real users, and increasingly get solved by cheap third-party services. Visually impaired users are punished disproportionately. And the popular alternatives ship browsing data to ad-tech companies. You need something that proves humanity without the friction — and without selling out your visitors."

solutionPoints:
  - title: "Invisible challenges for most users. "
    detail: "Turnstile evaluates browser signals (TLS fingerprint, canvas, behavioral hints) and silently passes the vast majority of real visitors. They never see a checkbox, never solve a puzzle."
  - title: "Privacy-first by design. "
    detail: "No tracking cookies, no fingerprinting that follows users across sites, no ad-tech monetization. Cloudflare doesn't need (or want) your visitors' data."
  - title: "Drop-in replacement for reCAPTCHA. "
    detail: "Same widget-on-page + server-side verify flow. Migration is typically a couple of hours: swap the script tag and update your verify endpoint."
  - title: "Works on any site, not just Cloudflare. "
    detail: "Turnstile is free and works on any origin — Cloudflare-hosted or not. Use it on forms, sign-ups, login screens, comment boxes, password resets."
  - title: "Server-side verification. "
    detail: "Every token is verified against Cloudflare's siteverify endpoint before you trust it. Tokens are single-use and expire fast, preventing replay."

faq:
  - question: "Is Turnstile really free, even at high volume?"
    answer: "Yes, free for everyone. Cloudflare uses Turnstile to improve its own bot detection (and the broader internet's), so it's offered at no cost regardless of traffic volume."
  - question: "What if a visitor still gets challenged? What do they see?"
    answer: "A simple managed challenge (a brief 'verifying you are human' spinner) or an interactive challenge for the most suspicious sessions. Far less intrusive than a Google CAPTCHA — no image grids, no audio puzzles, no 'select all crosswalks.'"
  - question: "Does Turnstile prevent every bot?"
    answer: "No tool does — but Turnstile catches the vast majority of common bot traffic against forms and login flows, especially when paired with rate limiting and Bot Management. For high-stakes endpoints (account creation, password reset), most customers stack Turnstile + bot scores + rate limiting."
  - question: "Can I use Turnstile on a mobile app?"
    answer: "Yes — Turnstile supports webview-based mobile flows and provides a JS API your native wrapper can call into. There's also a server-to-server attestation API for fully native flows."

demo:
  type: "interactive"
  component: "TurnstileDemo"
  note: "Pick a scenario below to open a mock login page under that outcome. Each one uses one of Cloudflare's public test sitekeys, verified against the real siteverify endpoint on the server — the site itself never sees or chooses the key."

diveDeeper:
  docs:
    - title: "Turnstile overview"
      url: "https://developers.cloudflare.com/turnstile/"
    - title: "Server-side siteverify"
      url: "https://developers.cloudflare.com/turnstile/get-started/server-side-validation/"
    - title: "Migrating from reCAPTCHA"
      url: "https://developers.cloudflare.com/turnstile/migration/"
  blogs:
    - title: "Introducing Turnstile, our friendly CAPTCHA alternative"
      url: "https://blog.cloudflare.com/turnstile-private-captcha-alternative/"
    - title: "Turnstile is now generally available"
      url: "https://blog.cloudflare.com/turnstile-ga/"
---
