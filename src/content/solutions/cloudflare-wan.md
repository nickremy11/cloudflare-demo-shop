---
title: "Cloudflare WAN (Magic WAN)"
blurb: "Replace MPLS, SD-WAN appliances, and site-to-site VPNs with a single connectivity fabric on Cloudflare's network. Every branch, data center, and cloud connects to one global private network."
pillar: "network"
order: 2

challenge:
  question: "Why does branch-to-branch and branch-to-cloud connectivity still require a hardware appliance and a private circuit?"
  detail: "Most enterprise WANs are a tangle of MPLS circuits, SD-WAN appliances per branch, IPsec tunnels between data centers, and cloud-specific connections (Direct Connect, ExpressRoute, Interconnect) for each cloud provider. Adding a new branch takes weeks. Adding cloud connectivity means another vendor. Hardware refresh cycles run hundreds of thousands of dollars. And the whole thing was designed when 'the network' meant a few corporate buildings — not 200 remote employees on home wifi."

solutionPoints:
  - title: "One global network as your WAN. "
    detail: "Cloudflare's 330+ city network *becomes* your private WAN. Connect every branch, data center, cloud VPC, and remote user — they're all on the same overlay, talking through Cloudflare."
  - title: "Connect anything with a tunnel. "
    detail: "Branches connect via IPsec or GRE from any router/firewall you already own. Cloud VPCs connect via Cloud Connector, BGP, or native cloud integrations. Remote users connect via WARP. Devices that don't speak modern tunnels can use the Magic WAN Connector appliance."
  - title: "Built-in security. "
    detail: "Every packet crosses Cloudflare and is subject to Magic Firewall, Gateway, and Cloudflare One policies. No separate security overlay — your WAN and your SSE are the same network."
  - title: "Optimized routing across the backbone. "
    detail: "Traffic between branches takes Cloudflare's optimized backbone routes — often faster than MPLS while costing dramatically less. Argo-style intelligence on top of native anycast."
  - title: "No hardware lock-in. "
    detail: "Use the routers and firewalls you already have. Cloudflare WAN doesn't need a proprietary appliance at every branch. No five-year hardware refresh cycles, no per-site licensing."

faq:
  - question: "How is this different from a traditional SD-WAN?"
    answer: "Traditional SD-WAN replaces MPLS with internet links overlaid with vendor appliances at every site. Cloudflare WAN replaces both: the overlay is Cloudflare's network, the appliance is software (or a connector for legacy sites). And it's natively integrated with Cloudflare Zero Trust, so the same platform handles WAN and SSE."
  - question: "Can I run Cloudflare WAN alongside my existing SD-WAN during migration?"
    answer: "Yes, that's the common pattern. Run both for a quarter or two, migrate sites one at a time, decommission your old SD-WAN once everything's stable. No big-bang cutover required."
  - question: "What about MPLS?"
    answer: "Many customers replace MPLS entirely with Cloudflare WAN + commodity internet. A few keep MPLS for specific legacy links (e.g. low-latency financial routes) and use Cloudflare for everything else. Both are supported."
  - question: "How does this connect to AWS / Azure / GCP?"
    answer: "Native integrations with each cloud's transit gateway, plus traditional IPsec from a VPC gateway. The result: your cloud VPCs are first-class participants on your WAN, addressable with the same policies as branch offices."

demo:
  type: "coming-soon"

diveDeeper:
  docs:
    - title: "Cloudflare WAN (Magic WAN) overview"
      url: "https://developers.cloudflare.com/magic-wan/"
    - title: "Magic WAN Connector"
      url: "https://developers.cloudflare.com/magic-wan/configuration/connector/"
    - title: "Cloud connector integrations"
      url: "https://developers.cloudflare.com/magic-wan/configuration/cloud-providers/"
  blogs:
    - title: "Cloudflare WAN: the network of the future"
      url: "https://blog.cloudflare.com/magic-wan/"
    - title: "How customers replaced MPLS with Cloudflare"
      url: "https://blog.cloudflare.com/magic-wan-ga/"
---
