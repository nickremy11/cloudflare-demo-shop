---
title: "API Security"
blurb: "Discover every API endpoint, validate requests against schema, enforce sequence-aware controls, and stop credential and token abuse — purpose-built for API traffic, not retrofitted from a WAF."
pillar: "app-security"
order: 3

challenge:
  question: "How do you secure something you don't even have an inventory of?"
  detail: "APIs are the backbone of every modern app and a primary attack surface — but most security teams can't list every endpoint their organization exposes. Shadow APIs (forgotten v1 routes, internal endpoints accidentally on the public network, partner integrations) are routinely exploited because no one was monitoring them. And when APIs *are* known, traditional WAFs struggle: they're built for HTML form input, not for structured JSON, OpenAPI schemas, sequenced calls, or token-based auth flows."

solutionPoints:
  - title: "API Discovery. "
    detail: "Cloudflare passively learns every endpoint your origin exposes by analyzing real traffic. Inventory appears in the dashboard within minutes — including the shadow APIs you forgot about."
  - title: "Schema validation. "
    detail: "Upload your OpenAPI spec (or let Cloudflare generate one from observed traffic). Requests that don't match the schema — wrong types, extra fields, missing parameters — are blocked at the edge before reaching your origin."
  - title: "Sequence Analytics &amp; Sequence Mitigation. "
    detail: "Detect business-logic abuse by analyzing the order and frequency of API calls (e.g. 'login → checkout without view-cart' or 'GET /price 1000× without POST /order'). Block patterns that don't match legitimate user flows."
  - title: "JWT validation &amp; session abuse detection. "
    detail: "Validate JWT signatures, expiration, and claims at the edge. Detect token sharing (same JWT from 30 different IPs), token replay, and impossible travel."
  - title: "Volumetric and resource abuse controls. "
    detail: "Per-endpoint rate limits with response-size-aware limits (your GraphQL endpoint shouldn't return 10MB to one client every second). Combine with WAF and bot rules for layered defense."

faq:
  - question: "Do I need to give Cloudflare my OpenAPI spec to get value?"
    answer: "No. Discovery works passively from real traffic, and Cloudflare can generate a candidate schema for you. Uploading your own spec makes validation more accurate, but you can start without one."
  - question: "Will this break my apps that send extra/unexpected fields?"
    answer: "Schema validation supports strict and lenient modes. Start lenient (log only), see what flags, then tighten. Most teams settle on 'block unexpected fields on auth endpoints, log on everything else.'"
  - question: "How is this different from just running a WAF on my API?"
    answer: "WAFs match request patterns against attack signatures (SQLi, XSS, etc.). API Security understands the structure of API calls: it knows that <code>POST /api/orders</code> must contain a numeric <code>quantity</code> field and must be preceded by a session token from <code>POST /api/login</code>. Pattern-matching WAFs can't catch that."
  - question: "What about GraphQL?"
    answer: "Cloudflare API Security parses GraphQL queries, applies depth and complexity limits, and can enforce per-field cost analysis. Standard GraphQL DoS patterns (nested introspection, deeply-recursive queries) are stopped at the edge."

demo:
  type: "coming-soon"

diveDeeper:
  docs:
    - title: "Cloudflare API Shield overview"
      url: "https://developers.cloudflare.com/api-shield/"
    - title: "API Discovery"
      url: "https://developers.cloudflare.com/api-shield/security/api-discovery/"
    - title: "Schema validation"
      url: "https://developers.cloudflare.com/api-shield/security/schema-validation/"
  blogs:
    - title: "Introducing API Shield"
      url: "https://blog.cloudflare.com/introducing-api-shield/"
    - title: "Sequence analytics for API security"
      url: "https://blog.cloudflare.com/api-sequence-analytics/"
---
