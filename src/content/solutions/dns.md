---
title: "DNS (+ Foundation DNS)"
blurb: "The fastest authoritative DNS network in the world by independent benchmarks, with DNSSEC, anycast everywhere, and enterprise-grade SLAs via Foundation DNS."
pillar: "app-security"
order: 11

challenge:
  question: "How much downtime have you taken from DNS issues over the years?"
  detail: "DNS is the first request of every user session and a frequent attack target. A DNS outage takes your entire estate offline. Slow DNS resolution adds 10–100ms to every cold session. And DNS misconfiguration — a missed propagation, a wrong record, an expired DNSSEC signature — is one of the most common causes of internet outages. Many companies underinvest here until their first DNS-driven incident, and then they overcorrect."

solutionPoints:
  - title: "Fastest authoritative DNS, measured. "
    detail: "Cloudflare consistently ranks #1 on independent benchmarks (DNSPerf) for authoritative DNS query response time. Anycast routing places every authoritative response a few milliseconds from the resolver."
  - title: "DNSSEC in one click. "
    detail: "Sign your zones with DNSSEC by toggling a switch — Cloudflare handles key rotation, signing, and DS record publication. No more KSK/ZSK ceremonies."
  - title: "DDoS-proof DNS. "
    detail: "Cloudflare DNS rides on the same anycast network that mitigated record-breaking DDoS attacks. Authoritative DNS is included with every plan, never goes down under attack, and is unmetered."
  - title: "Foundation DNS for enterprise. "
    detail: "Dedicated DNS resolvers with advanced analytics, query logs, custom Anycast IPs, and a financially-backed 100% uptime SLA. Built for telcos, financial services, and high-volume zones."
  - title: "Programmatic everything. "
    detail: "Cloudflare API + Terraform support every DNS record type and zone setting. CI/CD your DNS like the rest of your infra."

faq:
  - question: "Is Cloudflare DNS the same as 1.1.1.1?"
    answer: "Same network, different role. 1.1.1.1 is Cloudflare's public *recursive* resolver — what end users point their devices at. Cloudflare DNS (the product covered here) is *authoritative* DNS for the domains you own. Both run on the same global anycast network."
  - question: "Does DNSSEC actually matter in 2025?"
    answer: "It matters for high-stakes domains (banking, government, healthcare) and for any domain published in a country that requires it. The downside is configuration complexity — which Cloudflare eliminates. Cost of having it: $0 extra. Cost of not having it: a Kaminsky-class cache poisoning event."
  - question: "What's the difference between regular Cloudflare DNS and Foundation DNS?"
    answer: "Foundation DNS adds: financially-backed 100% uptime SLA, dedicated authoritative name servers (instead of the shared 'name1.cloudflare.com' pool), advanced query analytics and logging, custom anycast IPs, and white-glove support. For most customers the default Cloudflare DNS is enough; Foundation DNS is for the regulated and the very high-volume."
  - question: "Can I host DNS at Cloudflare without using Cloudflare for traffic proxying?"
    answer: "Yes. Records can be 'DNS only' (gray cloud) or 'proxied' (orange cloud). DNS only means Cloudflare just answers the record; traffic goes directly to your origin. Many customers start there and add the proxy later."

demo:
  type: "interactive"
  component: "DnsDemo"
  note: "Look up any domain via Cloudflare's DNS-over-HTTPS resolver at 1.1.1.1. The query travels to the nearest Cloudflare PoP, which is the same network that serves authoritative DNS for millions of zones."

diveDeeper:
  docs:
    - title: "Cloudflare DNS"
      url: "https://developers.cloudflare.com/dns/"
    - title: "DNSSEC"
      url: "https://developers.cloudflare.com/dns/dnssec/"
    - title: "Foundation DNS"
      url: "https://developers.cloudflare.com/dns/foundation-dns/"
  blogs:
    - title: "Cloudflare DNS — fastest in the world (again)"
      url: "https://blog.cloudflare.com/dns-perf-2024/"
    - title: "Foundation DNS for the world's largest networks"
      url: "https://blog.cloudflare.com/foundation-dns/"
---
