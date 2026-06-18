---
title: "Web Application Firewall"
blurb: "Block SQL injection, XSS, command injection, and the rest of the OWASP Top 10 with managed rulesets plus your own custom rules — written once, enforced everywhere."
pillar: "app-security"
order: 1

challenge:
  question: "How do you keep up with web attacks you've never seen before?"
  detail: "New CVEs in popular frameworks (Spring4Shell, Log4Shell, MOVEit, ...) appear with little warning, and exploitation begins within hours. Your application can be patched in days — but in the meantime every request is a roll of the dice. On top of that, custom-built apps have their own logic flaws that no patch will ever fix, and they're constantly targeted by SQLi, XSS, and command-injection payloads."

diagram:
  src: "/diagrams/app-sec-arch.png"
  alt: "Cloudflare WAF traffic flow"
  caption: "Every request is inspected against managed and custom rulesets before reaching your origin."

solutionPoints:
  - title: "Cloudflare Managed Ruleset. "
    detail: "Continuously updated rules that block known exploitation patterns: SQLi, XSS, RCE, LFI, command injection, and emerging CVEs. Cloudflare's security team ships new mitigations the same day a public PoC drops."
  - title: "OWASP Core Ruleset. "
    detail: "The industry-standard ModSecurity-style ruleset, tuned and curated by Cloudflare. Set per-domain sensitivity (low / medium / high) and choose between paranoia levels."
  - title: "Custom rules in a familiar language. "
    detail: "Write rules in Cloudflare's rules expression language (e.g. <code>http.request.uri.path contains \"/admin\" and ip.geoip.country ne \"US\"</code>) and apply block, challenge, log, or skip actions."
  - title: "Test before you enforce. "
    detail: "Every ruleset and rule supports log-only mode. Deploy globally, watch the analytics for false positives, then flip to block once you're confident. Zero-downtime tuning."
  - title: "Exception handling and bypass. "
    detail: "Whitelist trusted IPs, internal QA traffic, or specific URLs from individual rules. Fine-grained enough to allow legitimate `SELECT` statements in your marketing CMS without disabling SQLi protection elsewhere."

faq:
  - question: "What happens when there's a new zero-day like Log4Shell?"
    answer: "Cloudflare's security team writes a mitigation rule and ships it to every zone in the Managed Ruleset, usually within hours of public disclosure. Customers on Cloudflare WAF were protected against Log4Shell, Spring4Shell, and MOVEit before most teams had even read the advisory."
  - question: "Will the WAF break my legitimate traffic?"
    answer: "It can, if your app sends weird-looking payloads (e.g. encoded user input that resembles attacks). The mitigation is to start in log mode, watch for false positives in the WAF analytics, and exclude specific rules for specific paths. Cloudflare's tuning UI surfaces top false-positive rules with one-click exceptions."
  - question: "Can I write rules that combine multiple signals (IP + path + header)?"
    answer: "Yes. The rules expression language supports boolean logic across any request field — country, ASN, headers, URI path, query string, body content, JA3 fingerprint, bot score, and more. You can build very surgical rules."
  - question: "Does the WAF inspect request bodies?"
    answer: "Yes, up to a configurable size limit (default 128KB; higher on Enterprise). POST bodies, JSON payloads, and form data are all inspected for attack signatures."

demo:
  type: "interactive"
  component: "WafDemo"
  note: "Fire real attack payloads against /api/waf/testattack. Cloudflare WAF rules configured on the demo zone evaluate each request — successful blocks return 403 and never reach the Worker. Unblocked attacks reach the Worker and return the simulated exploit data."

diveDeeper:
  docs:
    - title: "Cloudflare WAF overview"
      url: "https://developers.cloudflare.com/waf/"
    - title: "Managed Rulesets"
      url: "https://developers.cloudflare.com/waf/managed-rules/"
    - title: "Custom rules"
      url: "https://developers.cloudflare.com/waf/custom-rules/"
  blogs:
    - title: "How Cloudflare blocked Log4Shell"
      url: "https://blog.cloudflare.com/cve-2021-44228-log4j-rce-0-day-mitigation/"
    - title: "AI-powered WAF: detecting unknown threats"
      url: "https://blog.cloudflare.com/ai-waf/"
---
