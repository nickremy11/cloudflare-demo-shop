---
title: "Secure Web Gateway"
blurb: "Inspect, filter, and log every DNS and HTTPS request leaving your users' devices. Block malware, phishing, and risky categories anywhere in the world from a single policy."
pillar: "sase"
order: 2

challenge:
  question: "How do you protect users browsing the open internet from anywhere?"
  detail: "Employees no longer sit behind a single office firewall. They work from cafés, hotels, and home offices. Without an in-line inspection layer, you have no visibility into the malicious sites they land on, the credentials they paste into lookalike domains, or the categories they're visiting that violate acceptable-use policy. Legacy on-prem proxies require backhaul that kills latency."

solutionPoints:
  - title: "DNS, network, and HTTP filtering in one policy. "
    detail: "Apply rules at the DNS layer (fast, lightweight), the L4 layer (IP/port), and the HTTP layer (URL, body, headers) — all from one policy engine, all enforced at Cloudflare's edge."
  - title: "TLS decryption for full inspection. "
    detail: "Decrypt and inspect HTTPS traffic when policy requires it, including the ability to scan for malware, sensitive data, and unsanctioned apps. Selectively bypass categories like healthcare and banking to respect user privacy."
  - title: "Categorized internet. "
    detail: "Cloudflare classifies billions of domains into 150+ content categories and continuously-updated security feeds (malware, phishing, command-and-control, newly-registered domains). Block by category in a single click."
  - title: "Anti-phishing intelligence. "
    detail: "Detect lookalike domains, brand impersonation, and credential-harvesting sites before users click. Block at DNS or via in-browser warnings."
  - title: "Anywhere enforcement via WARP. "
    detail: "The WARP client sends all device traffic through Cloudflare regardless of physical location. Policies follow the user, not the office."

faq:
  - question: "Will TLS decryption break apps or violate user privacy?"
    answer: "Selective decryption lets you bypass sensitive categories (banking, healthcare) and specific hostnames. Cloudflare publishes its CA root and a configuration profile so devices trust the inspection certificate. Most modern apps handle this transparently."
  - question: "How is this different from a DNS-only filter like 1.1.1.1 for Families?"
    answer: "DNS filtering is one layer, and it's fast and lightweight. SWG adds full HTTP and L4 inspection, body scanning, file upload/download policy, and integration with identity — so you can write rules like 'allow Salesforce only for the Sales group' or 'block file uploads to unmanaged personal cloud storage.'"
  - question: "What does the user experience look like when something is blocked?"
    answer: "By default, a clean Cloudflare-branded block page explains why. You can customize the message, add a request-access link to your ticketing system, or warn-and-continue for low-severity categories."
  - question: "Does it work on mobile?"
    answer: "Yes. WARP runs on iOS, Android, macOS, Windows, Linux, and ChromeOS. For BYOD or unmanaged devices, you can publish a hostname-based portal (Browser Isolation) instead of requiring the client."

demo:
  type: "coming-soon"

diveDeeper:
  docs:
    - title: "Cloudflare Gateway overview"
      url: "https://developers.cloudflare.com/cloudflare-one/policies/gateway/"
    - title: "DNS, network, and HTTP policies"
      url: "https://developers.cloudflare.com/cloudflare-one/policies/gateway/"
    - title: "Deploying WARP"
      url: "https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/"
  blogs:
    - title: "Stopping phishing attacks with Cloudflare Gateway"
      url: "https://blog.cloudflare.com/category/zero-trust-week-2023/"
    - title: "How Cloudflare protects its own employees"
      url: "https://blog.cloudflare.com/how-cloudflare-implements-zero-trust/"
---
