---
title: "Client-Side Security"
blurb: "Inventory every third-party script and connection running in your users' browsers. Detect Magecart-style skimmers, supply-chain compromise, and unexpected data exfiltration — automatically."
pillar: "app-security"
order: 4

challenge:
  question: "Do you know what every script on your website is doing in your customers' browsers?"
  detail: "Modern websites load dozens of third-party scripts — analytics, tag managers, payment widgets, A/B testing, chat tools, social embeds. Each one is a piece of code you didn't write, running in your users' browsers, with full access to forms and cookies. When one of those scripts is compromised (Magecart-style skimmer attacks, supply-chain takeovers, NPM package hijacks), customer data — including credit-card numbers entered on your checkout page — silently exfiltrates to the attacker. PCI DSS 4.0 explicitly requires you to manage and monitor this."

solutionPoints:
  - title: "Automatic script inventory. "
    detail: "Page Shield uses real browser telemetry to discover every script your site loads — including scripts loaded by other scripts. New scripts trigger alerts so you notice the change."
  - title: "Connection monitoring. "
    detail: "See every external endpoint your pages talk to (fetch, XHR, WebSocket, beacon). Surface unexpected destinations — a payment widget that suddenly calls a Russian domain is a flag."
  - title: "Malicious &amp; obfuscated script detection. "
    detail: "Cloudflare's threat intelligence flags known skimmer signatures, malicious URLs, and heuristically detects suspicious obfuscation patterns common to Magecart variants."
  - title: "Content Security Policy (CSP) generation. "
    detail: "Generate and roll out CSP headers based on observed legitimate traffic — no more guessing what your CSP should allow. Page Shield reports CSP violations so you can tighten without breaking the site."
  - title: "PCI DSS 4.0 compliance. "
    detail: "Requirements 6.4.3 and 11.6.1 (inventory, integrity monitoring, change detection for payment pages) are met out of the box with Page Shield's alerting and reporting."

faq:
  - question: "Does Page Shield add latency to my pages?"
    answer: "No. The detection happens via a tiny CSP-style reporting endpoint and from Cloudflare's view of the request traffic — nothing executes synchronously on your critical path."
  - question: "What's the difference between Page Shield and a WAF?"
    answer: "The WAF protects server-side: it sees and blocks requests *to* your origin. Page Shield protects client-side: it sees what's running *in the user's browser* after your origin has already responded. Magecart and supply-chain attacks specifically target the browser layer; the WAF can't see them."
  - question: "Will Page Shield generate a CSP automatically?"
    answer: "Yes. Based on observed legitimate script and connection sources over a period of time, Page Shield will recommend a tight CSP. You can deploy it in report-only mode first, watch for violations, and then enforce."
  - question: "What action does Page Shield take when it finds a malicious script?"
    answer: "Today, Page Shield alerts you — it doesn't block scripts in-line by default (because that risks breaking your site if a legitimate script is misclassified). Most customers use the alert to investigate and roll a tighter CSP. Active blocking via CSP is a one-click follow-up."

demo:
  type: "interactive"
  component: "PageShieldDemo"
  note: "The live demo runs on a dedicated checkout page at /client-side-security/checkout so Client-Side Security has a clean, stable surface to inventory. Use the scenario toggles below to flip alert scenarios on that page — coinhive injection (new script + malicious domain), unexpected connection, unexpected cookie, or a code change to an already-fingerprinted analytics script. Hit Open Checkout to view the demo surface, then trigger an alert and watch it land in the dashboard."

diveDeeper:
  docs:
    - title: "Client-side security overview"
      url: "https://developers.cloudflare.com/client-side-security/"
    - title: "Monitor resources and cookies"
      url: "https://developers.cloudflare.com/client-side-security/detection/monitor-connections-scripts/"
    - title: "Content security rules (CSP)"
      url: "https://developers.cloudflare.com/client-side-security/rules/"
    - title: "How client-side security works"
      url: "https://developers.cloudflare.com/client-side-security/how-it-works/"
  blogs:
    - title: "Page Shield is now generally available"
      url: "https://blog.cloudflare.com/page-shield-generally-available/"
    - title: "Magecart attacks and how to stop them"
      url: "https://blog.cloudflare.com/introducing-page-shield/"
---
