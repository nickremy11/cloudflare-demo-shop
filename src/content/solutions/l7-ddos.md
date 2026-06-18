---
title: "Layer 7 DDoS Protection"
blurb: "Absorb application-layer floods that look like legitimate HTTP requests. Always-on, autonomous mitigation tuned to your traffic patterns — no manual signature work required."
pillar: "app-security"
order: 5

challenge:
  question: "What happens when the attack traffic looks identical to your real users?"
  detail: "L7 (application-layer) DDoS isn't about bandwidth — it's about expensive requests. Attackers craft floods that look like real HTTP traffic: valid TLS, valid headers, valid user-agents, hitting your /search or /cart endpoints. Each request is cheap to send but expensive to serve, and ten million per second will exhaust your origin's database, app server, or auth system long before your bandwidth is touched. Volumetric DDoS gets the headlines, but L7 attacks are the ones that quietly take production down."

solutionPoints:
  - title: "Autonomous detection at the edge. "
    detail: "Cloudflare's DDoS engine analyzes every request and identifies attack fingerprints — traffic shape, timing, request similarity — without you tuning anything. New attacks trigger mitigations automatically, often before your dashboards even spike."
  - title: "Adaptive DDoS mitigation. "
    detail: "Profiles your normal traffic over time and detects deviations. An L7 flood of <code>POST /api/checkout</code> from new IPs gets challenged or blocked because it doesn't match your baseline — even if no static signature would catch it."
  - title: "Customizable response thresholds. "
    detail: "Set sensitivity levels per zone or per ruleset. Action gradients: log → challenge → JS challenge → managed challenge → block. Combine with rate limiting and bot management for surgical defense."
  - title: "Unmetered &amp; always-on. "
    detail: "Cloudflare doesn't charge by attack size and never asks you to 'enable surge protection.' Mitigation is always on, included with every plan, even Free."
  - title: "HTTP/2 and HTTP/3 native. "
    detail: "Detects and mitigates protocol-level attacks like HTTP/2 Rapid Reset (CVE-2023-44487) — Cloudflare disclosed and ships fixes for these classes of attack."

faq:
  - question: "What's the difference between L7 DDoS and the WAF?"
    answer: "WAF blocks bad *requests* (SQLi, XSS). L7 DDoS blocks bad *traffic patterns* (floods, slow-loris, application-layer abuse). They run in the same pipeline and complement each other — WAF for known attacks, DDoS for volumetric and behavioral patterns."
  - question: "Will I get false positives during legitimate traffic surges (a Black Friday spike)?"
    answer: "Cloudflare's adaptive mitigation learns your baseline traffic and accounts for expected growth. You can also pre-warn the platform of expected spikes via your account team. Most customers report zero impact on legitimate traffic during DDoS events."
  - question: "How do I know I'm under attack — and how do I know Cloudflare handled it?"
    answer: "Real-time dashboards show every mitigation. Each blocked event is logged with rule IDs, action, and traffic shape. You can also configure email and webhook alerts when mitigation thresholds are crossed."
  - question: "What about Layer 3/4 (network-layer) DDoS?"
    answer: "Cloudflare also mitigates L3/L4 floods automatically — covered under the Magic Transit / network-layer story. Both layers are protected by the same anycast network."

demo:
  type: "coming-soon"

diveDeeper:
  docs:
    - title: "Cloudflare DDoS protection"
      url: "https://developers.cloudflare.com/ddos-protection/"
    - title: "HTTP DDoS managed ruleset"
      url: "https://developers.cloudflare.com/ddos-protection/managed-rulesets/http/"
    - title: "Adaptive DDoS Protection"
      url: "https://developers.cloudflare.com/ddos-protection/managed-rulesets/http/adaptive-protection/"
  blogs:
    - title: "Cloudflare mitigated the largest DDoS attack ever recorded"
      url: "https://blog.cloudflare.com/cloudflare-mitigates-record-breaking-71-million-request-per-second-ddos-attack/"
    - title: "HTTP/2 Rapid Reset attack disclosure"
      url: "https://blog.cloudflare.com/technical-breakdown-http2-rapid-reset-ddos-attack/"
---
