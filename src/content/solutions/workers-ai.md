---
title: "Workers AI"
blurb: "Run inference on 50+ open models (Llama, Mistral, Stable Diffusion, Whisper, embeddings, translation) on Cloudflare's global GPU network. Per-token pricing, no GPU provisioning."
pillar: "developer"
order: 2

challenge:
  question: "How do you ship AI features without provisioning and operating GPU infrastructure?"
  detail: "Self-hosting an LLM means renting expensive GPUs (or buying them), provisioning across regions for latency, managing CUDA versions and model serving, and paying for idle GPU time when traffic is low. Using OpenAI is great for prototyping but the per-call costs add up, your data leaves your control, and you're tied to one vendor's roadmap. You need a third option: open models, hosted close to users, billed only when you actually run inference."

solutionPoints:
  - title: "50+ open models out of the box. "
    detail: "Llama 3.x, Mistral, Gemma, Stable Diffusion, Whisper, BGE embeddings, m2m translation, summarization, classification, and more. New models added regularly."
  - title: "Inference on Cloudflare's GPU network. "
    detail: "GPUs deployed across Cloudflare's edge so inference happens near the user. No region selection, no provisioning, no warm-pool worry."
  - title: "Per-token billing. "
    detail: "Pay only for tokens generated and processed. No idle GPU charges. Models priced individually — small models (1–8B) are cheap enough for high-volume use cases."
  - title: "Native Workers binding. "
    detail: "Inside a Worker, run inference with <code>await env.AI.run('@cf/meta/llama-3.1-8b-instruct', { prompt: '...' })</code>. No HTTP, no auth tokens — just a function call."
  - title: "Integrated stack. "
    detail: "Pair Workers AI with Vectorize (vector DB), R2 (object storage), D1 (SQL), and AI Gateway (observability, caching, fallback) — all on one platform, with sub-millisecond bindings between them."

faq:
  - question: "How does this differ from calling OpenAI from a Worker?"
    answer: "Both work. OpenAI gets you GPT-4-class quality on a paid model. Workers AI gets you open models that run on Cloudflare's network — often dramatically cheaper, with your data never leaving Cloudflare, and integrated with the rest of the stack. Most customers use both: open models for high-volume use cases (classification, embeddings, simple completions) and OpenAI/Anthropic via AI Gateway for the heavy reasoning."
  - question: "What models are available?"
    answer: "Llama 3.x (1B to 70B), Mistral, Gemma, Stable Diffusion XL, Whisper, m2m100, BGE embeddings, code-completion models, and more. The model catalog is published in the docs and updated continuously."
  - question: "Can I fine-tune models on Workers AI?"
    answer: "LoRA adapters are supported on selected base models. Upload your trained LoRA weights and run inference with them at runtime. Full fine-tuning of base weights happens off-platform."
  - question: "What's the latency like compared to a self-hosted GPU?"
    answer: "Inference latency depends on model size. Small models (1–3B) typically respond in low hundreds of milliseconds. Larger models (70B) take longer to generate but still avoid the cross-region hop you'd have with a centralized GPU farm."

demo:
  type: "interactive"
  component: "WorkersAiDemo"
  note: "Send a prompt below — it runs against Llama 3.3 70B via this site's existing AI Gateway → Workers AI pipeline. Same path the chatbot uses."

diveDeeper:
  docs:
    - title: "Workers AI overview"
      url: "https://developers.cloudflare.com/workers-ai/"
    - title: "Model catalog"
      url: "https://developers.cloudflare.com/workers-ai/models/"
    - title: "AI bindings from Workers"
      url: "https://developers.cloudflare.com/workers-ai/get-started/workers-bindings/"
  blogs:
    - title: "Workers AI is generally available"
      url: "https://blog.cloudflare.com/workers-ai-ga/"
    - title: "Building production AI apps on Cloudflare"
      url: "https://blog.cloudflare.com/ai-week-2024-wrap-up/"
---
