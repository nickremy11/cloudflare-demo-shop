---
title: "Magic Firewall"
blurb: "A cloud-delivered Layer 3 / 4 firewall for your entire network. Stateful packet filtering, geo-blocking, and protocol enforcement applied at Cloudflare's edge — no appliance to deploy."
pillar: "network"
order: 3

challenge:
  question: "How do you manage firewall policy consistently across data centers, branches, and clouds?"
  detail: "Most enterprises run a dozen different firewalls: physical appliances in each data center, virtual ones in each cloud VPC, branch firewalls in every office. Each has its own UI, its own rule syntax, its own audit log. Keeping policy consistent — same geo-blocks, same allowed ports, same vendor blocks — is operational pain that scales with the number of sites. A single misconfiguration on the wrong firewall is a breach waiting to happen."

solutionPoints:
  - title: "One firewall in front of everything. "
    detail: "Magic Firewall sits at Cloudflare's edge in front of all traffic to your network (when paired with Magic Transit or Magic WAN). Write one policy; it applies everywhere your prefixes are advertised."
  - title: "Stateful L3/L4 inspection. "
    detail: "Filter by source/destination IP, port, protocol, TCP flags, packet length, country, ASN, or arbitrary IPv4/IPv6 header fields. Stateful — track connections rather than just stateless packet matches."
  - title: "Wireshark-style expressions. "
    detail: "Familiar rule language: <code>ip.geoip.country eq \"RU\" and tcp.dstport eq 22</code>. No proprietary CLI to learn."
  - title: "Programmable via API and Terraform. "
    detail: "Manage rules as code. Pipeline changes through your normal review/approval workflow. No more 'who edited rule 47 at 3am Saturday.'"
  - title: "Integrated DDoS and threat intelligence. "
    detail: "Magic Firewall sits on the same network that mitigates DDoS automatically. Layer your stateful rules on top of always-on volumetric protection — and reference Cloudflare's threat-intel IP lists in your rules."

faq:
  - question: "Does Magic Firewall replace my edge firewall appliances?"
    answer: "For most outbound and inbound L3/L4 policy, yes — that work moves to Magic Firewall. Some customers keep on-prem firewalls for east-west traffic within data centers (which Cloudflare doesn't see). The dramatic reduction in north-south appliance complexity is usually the operational win."
  - question: "What's the difference between Magic Firewall and the WAF?"
    answer: "Magic Firewall is L3/L4 — IPs, ports, protocols. WAF is L7 — HTTP requests, headers, bodies. They run at different layers of the stack and are complementary. Magic Firewall protects your whole network including non-HTTP services; WAF protects your web apps specifically."
  - question: "Can I write rules that reference Cloudflare's threat lists?"
    answer: "Yes. Cloudflare maintains continuously-updated IP lists for known malicious sources, Tor exits, anonymizing VPNs, etc. Reference them in rules: <code>not ip.src in $cf_anonymizer</code>. Lists update automatically — no manual feed management."
  - question: "How is this licensed — per Gbps, per rule, per site?"
    answer: "Typically as part of the Magic Transit / Magic WAN bundle, sized by your protected bandwidth. Rules and sites are unmetered within the bundle."

demo:
  type: "coming-soon"

diveDeeper:
  docs:
    - title: "Magic Firewall overview"
      url: "https://developers.cloudflare.com/magic-firewall/"
    - title: "Rules and expressions"
      url: "https://developers.cloudflare.com/magic-firewall/how-to/add-rules/"
    - title: "Managed lists"
      url: "https://developers.cloudflare.com/magic-firewall/about/configurable-managed-lists/"
  blogs:
    - title: "Introducing Magic Firewall"
      url: "https://blog.cloudflare.com/introducing-magic-firewall/"
    - title: "Replacing legacy firewalls with Magic Firewall"
      url: "https://blog.cloudflare.com/magic-firewall-ga/"
---
