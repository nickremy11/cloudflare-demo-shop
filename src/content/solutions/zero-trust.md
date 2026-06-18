---
title: "Zero Trust Access (VPN Replacement)"
blurb: "Replace your legacy VPN with identity-aware, per-application access. Every request is verified against user identity, device posture, and policy — no implicit network trust."
pillar: "sase"
order: 1

challenge:
  question: "Why is a flat-network VPN a security and productivity problem?"
  detail: "Traditional VPNs put every authenticated user on the corporate network, granting broad access far beyond what any one role actually needs. One compromised credential or stolen laptop becomes a lateral-movement event. On top of that, VPN concentrators become single points of failure and add real latency for remote employees, contractors, and partners — all while creating friction every time someone needs to reach an internal app."

diagram:
  src: "/diagrams/cf-overall-traffic.png"
  alt: "Cloudflare Zero Trust traffic flow"
  caption: "Users connect to specific apps through Cloudflare — never to a flat corporate network."

solutionPoints:
  - title: "Per-application access, not network access. "
    detail: "Cloudflare Access publishes individual apps (web, SSH, RDP, internal APIs) behind identity and policy. Users reach only what they're explicitly allowed to reach — no implicit trust of the network they're on."
  - title: "Any identity provider, any device. "
    detail: "Federates with Okta, Microsoft Entra ID, Google, Auth0, GitHub, SAML, OIDC, and more. Layer on device posture signals (managed device, OS version, disk encryption) and require WARP enrollment when needed."
  - title: "Connects to anything, anywhere. "
    detail: "Cloudflare Tunnel exposes apps from your data center, VPC, or even a developer laptop without opening inbound ports. Public IPs disappear from your origin."
  - title: "Faster than a VPN. "
    detail: "Traffic terminates at the nearest Cloudflare location (300+ cities) and reaches the app over Cloudflare's backbone. No backhauling through a regional VPN concentrator."
  - title: "Audit everything. "
    detail: "Every authentication event, policy decision, and session is logged and exportable to your SIEM. Replace 'who was on the VPN' with 'who touched which app and when.'"

faq:
  - question: "Do I have to rip out my existing VPN on day one?"
    answer: "No. The typical migration runs Access alongside the legacy VPN, app by app. Start with one or two high-value internal apps, prove the workflow, then expand. Most customers retire their VPN over 3–6 months."
  - question: "What about non-HTTP apps like SSH, RDP, or databases?"
    answer: "Cloudflare Tunnel and Access for Infrastructure handle TCP and UDP traffic. Users can connect via the WARP client or, for SSH/RDP, through a browser-rendered terminal that requires no native client."
  - question: "Does this work for contractors and partners who aren't in our IdP?"
    answer: "Yes. You can add one-time PIN (email OTP) as an identity source for guest users, or federate with their IdP. Access policies can require additional signals (country, device posture, MFA) on top."
  - question: "How is this different from a typical IdP + SSO setup?"
    answer: "SSO authenticates the user once into individual apps. Zero Trust Access sits in front of every app and enforces continuous policy on every request — identity, device, location, time of day, and more — and protects apps that don't natively support SSO."

demo:
  type: "coming-soon"

diveDeeper:
  docs:
    - title: "Cloudflare Access overview"
      url: "https://developers.cloudflare.com/cloudflare-one/policies/access/"
    - title: "Cloudflare Tunnel"
      url: "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/"
    - title: "Replacing your VPN with Cloudflare Access"
      url: "https://developers.cloudflare.com/learning-paths/replace-vpn/"
  blogs:
    - title: "How Cloudflare runs without a VPN"
      url: "https://blog.cloudflare.com/how-cloudflare-implements-zero-trust/"
    - title: "Zero Trust SIM, WARP, and the post-VPN world"
      url: "https://blog.cloudflare.com/zero-trust-warp-with-a-twist/"
---
