---
title: "Web Application Firewall"
blurb: "The Cloudflare Web Application Firewall (WAF) provides automatic protection from vulnerabilities and the flexibility to create custom rules. Get automatic protection from vulnerabilities and the flexibility to create custom rules."
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
  - title: "Custom Rules"
    detail: "Create your own custom rules to protect your website and your APIs from malicious incoming traffic."
  - title: "Managed Rules"
    detail: "Enable the pre-configured managed rulesets to get immediate protection against common attacks."
  - title: "Rate Limiting Rules"
    detail: "Define rate limits for incoming requests matching an expression, and the action to take when those rate limits are reached."
  - title: "Security Analytics"
    detail: "Displays information about all incoming HTTP requests, including those not affected by security measures."
  - title: "Security Events"
    detail: "Review mitigated requests (rule matches) using an intuitive interface."

faq:
  - question: "What is the Cloudflare Web Application Firewall (WAF)?"
    answer: "The Cloudflare Web Application Firewall (WAF) provides automatic protection from vulnerabilities and the flexibility to create custom rules."
  - question: "What are managed rulesets?"
    answer: "Managed rulesets are pre-configured rulesets that protect against web application exploits such as zero-day vulnerabilities and top-10 attack techniques."
  - question: "Can I create custom rules?"
    answer: "Yes, you can create custom rules to block, challenge, or allow requests matching custom expressions."

demo:
  type: "interactive"
  component: "WafDemo"
  note: "Fire real attack payloads against /api/waf/testattack. Cloudflare WAF rules configured on the demo zone evaluate each request — successful blocks return 403 and never reach the Worker. Unblocked attacks reach the Worker and return the simulated exploit data."

diveDeeper:
  docs:
    - title: "Getting Started with Cloudflare WAF"
      url: "https://developers.cloudflare.com/waf/get-started/"
    - title: "Managed Rules"
      url: "https://developers.cloudflare.com/waf/managed-rules/"
    - title: "Custom Rules"
      url: "https://developers.cloudflare.com/waf/custom-rules/"
  blogs:
    - title: "How Cloudflare blocked Log4Shell"
      url: "https://blog.cloudflare.com/cve-2021-44228-log4j-rce-0-day-mitigation/"
    - title: "AI-powered WAF: detecting unknown threats"
      url: "https://blog.cloudflare.com/ai-waf/"
  blogTag:
    slug: "web-application-firewall"
    label: "Web Application Firewall"
lastVerified: "2026-07-28"
sources:
  - "https://developers.cloudflare.com/waf/"
  - "https://developers.cloudflare.com/waf/managed-rules/"
  - "https://developers.cloudflare.com/waf/custom-rules/"
---
