---
title: "Browser Isolation"
blurb: "Render risky web pages on Cloudflare's network, not on the user's device. The browser receives only safe draw commands — malware, drive-by downloads, and zero-days can't reach the endpoint."
pillar: "sase"
order: 3

challenge:
  question: "How do you let users browse anywhere without exposing endpoints to risk?"
  detail: "The browser is the new operating system, and it's where most attacks land — drive-by malware, zero-day exploits, credential theft on lookalike sites, and data exfiltration through file uploads and copy/paste. Blocking the open internet is bad for productivity. Allowing it is a constant source of incidents and IR work."

solutionPoints:
  - title: "Remote rendering on Cloudflare's network. "
    detail: "When a user opens an isolated session, Chromium runs on Cloudflare's edge. The local browser receives only the rendered output (network vector rendering), not the raw page. Any malicious code executes in a disposable container, never on the user's machine."
  - title: "No native client required. "
    detail: "Works in any modern browser (Chrome, Edge, Firefox, Safari) — no plugin or VDI agent. Users don't need to know they're isolated."
  - title: "Granular data controls. "
    detail: "Disable copy/paste, downloads, uploads, printing, or keyboard input per session. Useful for SaaS apps containing sensitive data, AI chatbots that shouldn't receive PII, or generally untrusted destinations."
  - title: "Isolate by policy, not all-or-nothing. "
    detail: "Use Gateway policies to isolate only the risky stuff — newly-registered domains, security feeds, unsanctioned AI sites, or unknown categories — while letting safe traffic flow directly. Users get a normal experience for 99% of sites and seamless protection for the 1%."

faq:
  - question: "Will this make browsing feel laggy?"
    answer: "Cloudflare uses NVR (network vector rendering) instead of pushing pixel streams, so the bandwidth and latency overhead are minimal. Most users can't tell the difference between an isolated session and a normal browser."
  - question: "What if I just want to isolate one specific site, like a webmail product?"
    answer: "Yes — you can isolate by hostname, URL pattern, category, or risk score. You can even publish a 'clientless' isolated link that opens a specific app in isolation for unmanaged or BYOD devices."
  - question: "Can I use this to safely interact with AI tools?"
    answer: "Yes. Isolation can disable file uploads, paste, and keyboard typing on sites like ChatGPT, Claude, or other generative AI tools — letting users read responses while preventing them from pasting sensitive data into the prompt."
  - question: "How does this differ from a VDI?"
    answer: "VDI runs an entire desktop in the cloud (expensive, complex, and slow). Browser Isolation runs just the browser tab in the cloud — invisible to the user, cheap, and integrated with the rest of Cloudflare Zero Trust."

demo:
  type: "external-link"
  externalUrl: "https://blog.cloudflare.com"
  note: "If your device is enrolled in Cloudflare WARP with a Browser Isolation Gateway policy applied, opening the link below will render blog.cloudflare.com in an isolated browser session rather than locally. Watch the browser address bar — you'll see a Cloudflare-issued isolated session URL."

diveDeeper:
  docs:
    - title: "Browser Isolation overview"
      url: "https://developers.cloudflare.com/cloudflare-one/policies/browser-isolation/"
    - title: "Network Vector Rendering (NVR)"
      url: "https://developers.cloudflare.com/cloudflare-one/policies/browser-isolation/setup/"
    - title: "Clientless web isolation"
      url: "https://developers.cloudflare.com/cloudflare-one/policies/browser-isolation/setup/clientless-browser-isolation/"
  blogs:
    - title: "Browser Isolation, redesigned"
      url: "https://blog.cloudflare.com/browser-isolation-data-protection/"
    - title: "Protecting employees from generative AI risks"
      url: "https://blog.cloudflare.com/cloudflare-one-for-ai/"
---
