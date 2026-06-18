---
title: "Argo Smart Routing"
blurb: "Route every cache-miss request across Cloudflare's private backbone using the fastest path right now — not the path BGP picks. Typically 30%+ TTFB improvement on dynamic traffic."
pillar: "app-security"
order: 8

challenge:
  question: "Why does dynamic content still feel slow even when you have a CDN?"
  detail: "CDNs help cached content. But every login, search, and API call still has to reach your origin — and BGP routing across the public internet is famously suboptimal. A request from Sydney to your origin in Virginia might cross three transit providers, hit congestion in Singapore, and take 400ms more than it needed to. Caching can't fix that, because the response isn't cacheable."

solutionPoints:
  - title: "Real-time network telemetry. "
    detail: "Cloudflare measures latency, packet loss, and congestion between every pair of edge locations continuously. Each path is scored in real time."
  - title: "Fastest path, not shortest path. "
    detail: "When a request would normally cross congested transit, Argo routes it through Cloudflare's private backbone instead — often via 2–3 edge locations the public internet wouldn't choose."
  - title: "Origin-to-Origin acceleration. "
    detail: "Works for HTTP, WebSocket, gRPC, and any TCP traffic going through Cloudflare. Especially impactful for cache-miss content, API calls, and long-distance origin connectivity."
  - title: "Measured improvement. "
    detail: "Across Cloudflare's customer base, Argo delivers ~30% TTFB improvement on uncached requests on average — with much larger wins on specific long-haul routes."
  - title: "One toggle, no code changes. "
    detail: "Enable Argo in the dashboard. No origin config, no SDK, no DNS changes."

faq:
  - question: "How is this different from regular Cloudflare CDN routing?"
    answer: "The standard CDN routes you to the closest edge (anycast). From there to your origin, traffic goes over the public internet via standard BGP. Argo replaces that origin-bound leg with intelligent backbone routing — same closest-edge for the user, much faster path from there to your origin."
  - question: "Does Argo work with Smart Routing for connections that aren't cached?"
    answer: "Argo specifically targets cache-miss traffic — that's the whole point. Cached requests don't need it (they never reach the origin)."
  - question: "What about Argo Tunnel — is that the same thing?"
    answer: "No. Argo *Tunnel* (now called Cloudflare Tunnel) is a different product: it's an outbound connector from your origin that creates a secure private link to Cloudflare without opening firewall ports. Argo *Smart Routing* is the path-optimization product. They can be used together."
  - question: "Will Argo help with WebSocket / long-lived connections?"
    answer: "Yes. WebSockets and gRPC streams benefit too — the route stays optimized for the lifetime of the connection. WebSocket clients in Asia connecting to origins in US/EU see substantial improvements."

demo:
  type: "coming-soon"

diveDeeper:
  docs:
    - title: "Argo Smart Routing"
      url: "https://developers.cloudflare.com/argo-smart-routing/"
    - title: "How Argo works"
      url: "https://developers.cloudflare.com/argo-smart-routing/about/"
  blogs:
    - title: "Argo: routing intelligence for the internet"
      url: "https://blog.cloudflare.com/argo/"
    - title: "Argo 2.0 — faster, smarter"
      url: "https://blog.cloudflare.com/argo-2/"
---
