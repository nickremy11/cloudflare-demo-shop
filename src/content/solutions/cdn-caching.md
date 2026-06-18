---
title: "CDN & Caching"
blurb: "Serve content from the Cloudflare location closest to every user, with cache controls that adapt to your app. 330+ cities, every request a chance to skip the origin entirely."
pillar: "app-security"
order: 7

challenge:
  question: "Why pay for origin bandwidth and CPU on requests you've already answered before?"
  detail: "Every uncached request costs you origin compute, database queries, and egress bandwidth — even when the response is identical to the one you sent ten seconds ago. And your origin lives in one or two regions, so users on the other side of the planet pay for that distance in latency. A global CDN should solve both problems, but most cache configurations are too cautious to actually help."

solutionPoints:
  - title: "330+ cities, anycast routed. "
    detail: "Cloudflare's edge spans 330+ cities. Anycast routing sends each user to the nearest location automatically — no DNS hacks, no GeoDNS configuration."
  - title: "Smart default caching. "
    detail: "Static assets (CSS, JS, images, fonts) are cached automatically by file extension. HTML is configurable per-rule. Tiered Caching consolidates upper-tier hits so cold edges don't all hammer your origin."
  - title: "Cache rules with precise control. "
    detail: "Set TTL, eligibility, and cache key per URL pattern. Cache HTML for logged-out users but bypass for logged-in. Cache by query string, by header, by cookie — or strip query strings entirely."
  - title: "Real-time analytics. "
    detail: "Watch hit ratio, bytes saved, and origin requests in real time. Each response carries <code>CF-Cache-Status</code> (HIT, MISS, EXPIRED, BYPASS) so you can debug directly from any browser's network tab."
  - title: "Instant purge. "
    detail: "Purge a single URL, a tag, a hostname, or everything globally — typically completing in &lt;5 seconds worldwide. Hook the API into your deploy pipeline so new builds invalidate the right URLs automatically."

faq:
  - question: "Will Cloudflare cache dynamic / personalized content?"
    answer: "By default no — but you can selectively cache responses with Cache Rules. Common patterns: cache API responses with short TTLs (10–30s), cache logged-out HTML with a Vary on cookies, or use Workers + Cache API for fully programmatic cache keys."
  - question: "What's the difference between Cloudflare's CDN and another vendor's?"
    answer: "Anycast everywhere (no DNS-based routing), the cache and security/DDoS layers run on the same nodes (one less hop), unmetered DDoS, and integration with Workers (programmatic cache control from the same JS that handles the request). Pricing is bandwidth-included on most plans."
  - question: "Does Cloudflare add egress charges like other clouds?"
    answer: "No. Cache hits don't add bandwidth charges. Even on the Free plan, there's no per-byte fee for delivery from Cloudflare's edge. R2 also has $0 egress — see the storage demo."
  - question: "What about cache poisoning?"
    answer: "Cloudflare normalizes request headers, validates origin responses, and integrates with the WAF to detect known cache-poisoning patterns. Cache keys can be locked to specific signal sets, preventing attackers from cache-stuffing via crafted query strings."

demo:
  type: "interactive"
  component: "CdnCacheDemo"
  note: "Below is a diagram served from a cacheable URL on this site. Watch CF-Cache-Status and TTFB change as you fetch it cold, hit it warm, and then trigger a real cache purge via the Cloudflare API."

diveDeeper:
  docs:
    - title: "CDN overview"
      url: "https://developers.cloudflare.com/cache/"
    - title: "Cache Rules"
      url: "https://developers.cloudflare.com/cache/how-to/cache-rules/"
    - title: "Tiered Cache"
      url: "https://developers.cloudflare.com/cache/how-to/tiered-cache/"
  blogs:
    - title: "How Cloudflare's CDN works"
      url: "https://blog.cloudflare.com/category/speed-week/"
    - title: "Tiered Cache: better hit ratios for free"
      url: "https://blog.cloudflare.com/orpheus/"
---
