---
title: "Load Balancing"
blurb: "Distribute traffic across origins anywhere — clouds, on-prem, regions — with smart health checks, geo-steering, and automatic failover. Global DNS-based and proxied options on the same platform."
pillar: "app-security"
order: 9

challenge:
  question: "How do you survive an origin outage without rewriting your DNS at 2am?"
  detail: "You have multiple origin servers across clouds and regions — for redundancy, capacity, or because legal made you. Routing users to the healthiest, closest origin requires constant health checks, geo-aware steering, and instant failover when something dies. Doing this with vendor-locked load balancers in one cloud doesn't help when that whole cloud has a bad day. Manual DNS failover is slow (TTLs!) and error-prone."

solutionPoints:
  - title: "Multi-region, multi-cloud, multi-DC. "
    detail: "Define origin pools spanning AWS regions, GCP regions, Azure regions, on-prem data centers, or any mix. Cloudflare steers users to the best pool by latency, geography, or weighted random."
  - title: "Smart, configurable health checks. "
    detail: "Active health checks from Cloudflare's edge — every 15s to 60s, from multiple regions, with custom HTTP probes, status code matching, and response body checks. Origins that fail get pulled out within seconds."
  - title: "Geo &amp; latency steering. "
    detail: "Route EU users to EU pools, US users to US pools, with fallback to the other region if one goes down. Or use 'proximity steering' where Cloudflare picks the origin with the best measured latency from each edge."
  - title: "Session affinity. "
    detail: "Stick users to a single origin via cookie or IP hash when needed (legacy apps without stateless sessions). Configurable TTLs."
  - title: "Built-in DDoS, WAF, and analytics. "
    detail: "Same platform — your load balancer benefits from Cloudflare's DDoS, WAF, and bot protection by default. One pane for traffic + security."

faq:
  - question: "Is this DNS-based or actually proxying traffic?"
    answer: "Both options are supported. Proxied load balancing (where Cloudflare terminates TLS and forwards) gives you fastest failover, layer 7 routing, and full analytics. DNS-only mode (for non-HTTP protocols or when you don't want a proxy) is also available with reasonable TTLs."
  - question: "Can I load-balance between AWS and GCP origins?"
    answer: "Yes. Cloudflare doesn't care where origins are hosted — they can be any combination of clouds, on-prem, or even other vendors. This is one of the main reasons multi-cloud customers use Cloudflare LB."
  - question: "How fast is failover when an origin dies?"
    answer: "With proxied LB and aggressive health-check intervals, failover typically completes within 10–30s after the origin starts failing. DNS-only failover is bounded by your DNS TTL."
  - question: "What about TCP/UDP traffic (databases, custom protocols)?"
    answer: "DNS-only LB handles any protocol via record-level steering. For TCP-proxied load balancing of non-HTTP protocols (e.g. SMTP, custom TCP), pair LB with Spectrum — also available on the platform."

demo:
  type: "coming-soon"

diveDeeper:
  docs:
    - title: "Cloudflare Load Balancing"
      url: "https://developers.cloudflare.com/load-balancing/"
    - title: "Health monitors"
      url: "https://developers.cloudflare.com/load-balancing/monitors/"
    - title: "Steering policies"
      url: "https://developers.cloudflare.com/load-balancing/understand-basics/traffic-steering/"
  blogs:
    - title: "Multi-cloud load balancing made simple"
      url: "https://blog.cloudflare.com/load-balancing/"
    - title: "Geo steering for global apps"
      url: "https://blog.cloudflare.com/geo-steering/"
---
