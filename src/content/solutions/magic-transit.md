---
title: "Magic Transit"
blurb: "DDoS protection, firewall, and traffic acceleration for your entire IP network. Cloudflare advertises your prefixes, scrubs L3/L4 attacks, and forwards clean traffic back to you over GRE, IPsec, or CNI."
pillar: "network"
order: 1

challenge:
  question: "What protects the rest of your network — the parts that don't sit behind a web proxy?"
  detail: "L7 protection covers your web apps, but the rest of your network — VPN concentrators, mail servers, gaming infrastructure, voice/SIP, custom TCP services, internal data centers — is exposed directly to the internet. A volumetric L3/L4 attack against a /24 you own can take down everything in that range simultaneously: web, DNS, email, the office VPN. Most ISPs offer DDoS scrubbing as an add-on with a manual escalation flow. By the time you call, you're already down."

solutionPoints:
  - title: "BGP-routed protection for your whole prefix. "
    detail: "Cloudflare advertises your IP prefixes via BGP. All inbound traffic to those IPs first lands on Cloudflare's network, gets scrubbed, and the clean traffic returns to you over GRE tunnels, IPsec, direct CNI cross-connects, or private network interconnects."
  - title: "L3/L4 DDoS — always on, unmetered. "
    detail: "SYN floods, UDP floods, amplification, reflection, GRE floods — mitigated automatically in seconds. Cloudflare has absorbed multi-terabit attacks for years; the network is built for it."
  - title: "Magic Firewall: stateful L3/L4 filtering. "
    detail: "Apply allow/deny rules to your entire network from a single policy: drop traffic from specific countries, block ports, allow only known partners. Programmable via dashboard or API."
  - title: "Anycast scrubbing at every PoP. "
    detail: "Unlike scrubbing centers in a few regions, Cloudflare scrubs at every one of 330+ locations. Attacks are dropped close to their source, not after they've crossed continents."
  - title: "Cleaner, faster traffic returns. "
    detail: "Clean traffic returns over Cloudflare's backbone, often with lower latency than the public-internet path would have given you. Acceleration is a side effect of the security architecture."

faq:
  - question: "Do I need to own my own IP prefixes for Magic Transit?"
    answer: "Yes — Magic Transit is for organizations that own /24 or larger IP space and route it via BGP. If you're a smaller customer who doesn't own IP space, Magic WAN + Magic Firewall + Spectrum together cover similar use cases without requiring your own prefix."
  - question: "What's the latency impact?"
    answer: "Often *negative* — clean traffic crosses Cloudflare's optimized backbone instead of going direct via the public internet. Customers in regions with bad transit see meaningful improvements. Customers already close to their users see neutral latency change."
  - question: "How does Magic Transit connect back to my data center?"
    answer: "Several options: GRE tunnels (most common), IPsec tunnels (when you need encryption), direct CNI (Cloudflare Network Interconnect) where you cross-connect inside an interconnection facility, or private network interconnects with public cloud providers."
  - question: "Is Magic Transit only for huge enterprises?"
    answer: "Pricing is tiered, but Magic Transit is widely deployed across mid-market enterprises with their own IP space — not just Fortune 500s. If you have a publicly-routable network and you're paying for any kind of DDoS protection today, it's worth comparing."

demo:
  type: "coming-soon"

diveDeeper:
  docs:
    - title: "Magic Transit overview"
      url: "https://developers.cloudflare.com/magic-transit/"
    - title: "BGP and prefix advertisement"
      url: "https://developers.cloudflare.com/magic-transit/reference/traffic-steering/"
    - title: "GRE and IPsec setup"
      url: "https://developers.cloudflare.com/magic-transit/about/anycast-gre/"
  blogs:
    - title: "How Magic Transit works"
      url: "https://blog.cloudflare.com/magic-transit/"
    - title: "Mitigating a 71M rps DDoS attack"
      url: "https://blog.cloudflare.com/cloudflare-mitigates-record-breaking-71-million-request-per-second-ddos-attack/"
---
