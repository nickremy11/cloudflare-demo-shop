---
title: "Spectrum"
blurb: "Reverse-proxy and DDoS protection for any TCP or UDP service — gaming, SSH, IRC, FTP, custom protocols. Same security stack Cloudflare runs for HTTP, extended to every port."
pillar: "network"
order: 4

challenge:
  question: "How do you protect non-HTTP services with the same rigor as your website?"
  detail: "Gaming servers, SSH bastions, IMAP/SMTP relays, MQTT brokers, financial-trading endpoints, custom binary protocols — none of these speak HTTP, so a regular CDN/WAF doesn't help. They sit on public IPs absorbing DDoS, exposing their real addresses to attackers, and giving you little ability to apply security policy without a network appliance per protocol."

solutionPoints:
  - title: "Reverse proxy for any TCP/UDP. "
    detail: "Bring your service behind Cloudflare by mapping a port to your origin. Cloudflare terminates the connection at the edge and proxies clean traffic back. Works for HTTP, but also SSH, FTP, IMAP/SMTP, IRC, RTMP, MQTT, MySQL, Postgres, gaming protocols, and anything else."
  - title: "L3/L4 DDoS protection on every port. "
    detail: "Volumetric and protocol-level attacks against any port get the same always-on mitigation as Cloudflare's HTTP traffic. SYN floods, UDP amplification, GRE floods, slow-loris — all dropped at the edge."
  - title: "Origin IP cloaking. "
    detail: "Your true origin IP is hidden behind Cloudflare's anycast IPs. Attackers see only Cloudflare; even if they enumerate every port, your actual infrastructure stays masked."
  - title: "TLS termination at the edge. "
    detail: "Cloudflare can terminate TLS for your TCP services, manage certs, and forward decrypted (or re-encrypted) traffic to your origin. One less cert renewal to manage per service."
  - title: "Anycast routing for gaming &amp; voice. "
    detail: "Players, callers, and devices connect to the nearest Cloudflare PoP and traffic crosses the backbone — meaningful latency improvements for global services where every millisecond matters."

faq:
  - question: "Do I need to use Cloudflare DNS to use Spectrum?"
    answer: "Yes — Spectrum needs to control the public IP that resolves to your service. Move the relevant DNS records to Cloudflare and Spectrum takes over the IP layer."
  - question: "How is this different from Magic Transit?"
    answer: "Magic Transit operates at the L3 network layer (BGP-routed prefixes — your entire network range). Spectrum is L4 reverse proxy (per-service: specific TCP/UDP ports). Use Magic Transit when you own and announce your own IP space; use Spectrum when you want per-service protection without operating BGP."
  - question: "Can I use Spectrum for SSH or RDP without exposing them to the internet at all?"
    answer: "You can — but for SSH/RDP, most customers prefer Cloudflare Access for Infrastructure (Zero Trust), which keeps the service behind an identity check rather than just IP-cloaking. Spectrum is right when you need protocol-native access (e.g. a CI runner using a real SSH key) plus DDoS protection."
  - question: "Does Spectrum break protocols that need the client's real IP?"
    answer: "For TCP, Cloudflare can prepend PROXY protocol headers so your origin still sees the real client IP. For UDP-heavy gaming, similar mechanisms exist. Most protocols are fine, but it's something to test during setup."

demo:
  type: "coming-soon"

diveDeeper:
  docs:
    - title: "Spectrum overview"
      url: "https://developers.cloudflare.com/spectrum/"
    - title: "Supported protocols"
      url: "https://developers.cloudflare.com/spectrum/protocols/"
    - title: "Origin IP cloaking"
      url: "https://developers.cloudflare.com/spectrum/reference/configuration-options/"
  blogs:
    - title: "Spectrum: bringing Cloudflare to every TCP port"
      url: "https://blog.cloudflare.com/introducing-spectrum/"
    - title: "Protecting gaming infrastructure with Spectrum"
      url: "https://blog.cloudflare.com/cloudflare-magic-spectrum/"
---
