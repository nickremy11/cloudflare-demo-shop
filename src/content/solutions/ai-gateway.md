---
title: "AI Gateway"
blurb: "One unified endpoint in front of every AI provider — OpenAI, Anthropic, Workers AI, Google, Azure, and more. Caching, rate limiting, logging, retries, and fallback as configuration."
pillar: "developer"
order: 4

challenge:
  question: "How do you control cost, latency, and observability across multiple AI providers?"
  detail: "Production AI apps quickly hit problems: per-call costs are unpredictable, you have no visibility into which prompts are expensive, repeated identical prompts cost money every time, one provider has an outage and your app goes down, and rate limits hit at the worst moments. The native solutions are each vendor's bespoke dashboard — which doesn't help when you're using three vendors. You need one control plane in front of all of them."

solutionPoints:
  - title: "Unified endpoint for every provider. "
    detail: "Point your code at a single Cloudflare AI Gateway URL and it routes to OpenAI, Anthropic, Workers AI, Google AI, Azure OpenAI, Mistral, Replicate, AWS Bedrock, or any compatible endpoint."
  - title: "Response caching. "
    detail: "Identical prompts return cached responses — configurable per-route. Production apps with repeated queries cut spend 30–70% with caching on. Optional semantic caching (cache near-identical prompts) is available too."
  - title: "Rate limiting &amp; spend controls. "
    detail: "Set per-app, per-key, per-user rate limits and budget caps. Stop runaway prompts and accidental fan-outs before they melt your bill."
  - title: "Fallback &amp; retries. "
    detail: "Route primary requests to OpenAI; on error or timeout, transparently fall back to Anthropic or Workers AI. Configurable per-route, per-model. Prevents single-provider outages from breaking your app."
  - title: "Full request/response logging. "
    detail: "Every prompt and completion logged with token counts, latency, cost, and metadata. Searchable, exportable, attributable. The 'what is my AI actually doing' problem solved."

faq:
  - question: "Does AI Gateway add latency?"
    answer: "Minimal — typically a few milliseconds for the routing decision. For cached requests, it actually *reduces* latency (the cached response is served from Cloudflare's edge instead of waiting for an OpenAI round-trip). For non-cached requests, the Gateway is on the same Cloudflare network that's already in the path, so the overhead is negligible."
  - question: "Can I bring my own API keys (BYOK) or do I need to use Cloudflare's?"
    answer: "BYOK. AI Gateway forwards your existing OpenAI/Anthropic/etc. keys — Cloudflare doesn't bill you for those provider charges; you keep your provider relationship. Cloudflare bills only for AI Gateway features (caching, logging, etc.), and the Workers AI models you choose to run."
  - question: "Does the cache understand 'similar' prompts, or only exact matches?"
    answer: "Both. Exact-match caching is on by default (same prompt + same parameters = cached). Semantic caching (similar prompts return the same cached response based on embedding similarity) is configurable per-route — useful for FAQ-style applications."
  - question: "What if I want to switch from OpenAI to Workers AI later?"
    answer: "Change a config in AI Gateway. Your app code doesn't change. Universal endpoint format means swapping models or providers is one route-config change."

demo:
  type: "interactive"
  component: "AiGatewayDemo"
  note: "Every message in the chatbot widget on this page routes through Cloudflare AI Gateway to Workers AI (Llama 3.3 70B). Send a test prompt below or open the chatbot — both share the same Gateway."

diveDeeper:
  docs:
    - title: "AI Gateway overview"
      url: "https://developers.cloudflare.com/ai-gateway/"
    - title: "Providers and routing"
      url: "https://developers.cloudflare.com/ai-gateway/providers/"
    - title: "Caching and rate limiting"
      url: "https://developers.cloudflare.com/ai-gateway/configuration/caching/"
  blogs:
    - title: "Cloudflare AI Gateway is now GA"
      url: "https://blog.cloudflare.com/ai-gateway-general-availability/"
    - title: "Building reliable AI apps with fallback"
      url: "https://blog.cloudflare.com/ai-gateway-fallbacks-universal-logs-mistral/"
---
