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
  - title: "RAG in a few lines with AI Search. "
    detail: "AI Search (AutoRAG) turns an R2 bucket into a managed retrieval pipeline: it chunks and embeds your documents into Vectorize, then at query time embeds the question, retrieves the closest chunks, reranks them for true relevance, and feeds them to a Workers AI model — every step powered by Workers AI models (embeddings, reranker, and the LLM). The demo below toggles this on and off."

faq:
  - question: "How does this differ from calling OpenAI from a Worker?"
    answer: "Both work. OpenAI gets you GPT-4-class quality on a paid model. Workers AI gets you open models that run on Cloudflare's network — often dramatically cheaper, with your data never leaving Cloudflare, and integrated with the rest of the stack. Most customers use both: open models for high-volume use cases (classification, embeddings, simple completions) and OpenAI/Anthropic via AI Gateway for the heavy reasoning."
  - question: "What models are available?"
    answer: "Llama 3.x (1B to 70B), Mistral, Gemma, Stable Diffusion XL, Whisper, m2m100, BGE embeddings, code-completion models, and more. The model catalog is published in the docs and updated continuously."
  - question: "Can I fine-tune models on Workers AI?"
    answer: "LoRA adapters are supported on selected base models. Upload your trained LoRA weights and run inference with them at runtime. Full fine-tuning of base weights happens off-platform."
  - question: "What's the latency like compared to a self-hosted GPU?"
    answer: "Inference latency depends on model size. Small models (1–3B) typically respond in low hundreds of milliseconds. Larger models (70B) take longer to generate but still avoid the cross-region hop you'd have with a centralized GPU farm."
  - question: "What is RAG, and how does the toggle in the demo work?"
    answer: "RAG (Retrieval-Augmented Generation) grounds an LLM in your own data instead of relying only on what the model memorised during training. With the toggle OFF, the prompt goes straight to Llama 3.3 70B — ask it about a private persona ('Remy Calder') and it correctly says it doesn't know. With the toggle ON, the request goes through AI Search (AutoRAG): the question is embedded, matched against a private profile document stored in R2 and indexed in Vectorize, reranked for relevance, and the top passages are handed to the same Llama model — which now answers correctly and cites the retrieved source. It's the same model in both cases; RAG just changes what context it's given."
  - question: "Does RAG replace the model's general knowledge?"
    answer: "No. The pipeline uses a reranker to decide whether the retrieved passages are actually relevant to the question. Ask something the private document covers and you get a grounded, cited answer; ask a general question it doesn't cover (e.g. 'What is Cloudflare?') and the retrieval is discarded so the model answers from its own training. Add more documents to the R2 bucket and those questions start getting grounded answers too — no code change required."

demo:
  type: "interactive"
  component: "WorkersAiDemo"
  note: "Send a prompt below. With RAG off, it runs against Llama 3.3 70B via this site's AI Gateway → Workers AI pipeline (the same path the chatbot uses). Flip on Enable RAG to route through AI Search (AutoRAG) instead — the question is embedded, matched against a private /aboutme profile stored in R2 + Vectorize, reranked, and answered with citations. Try “What is Remy Calder's internal codename?” both ways: off, the model doesn't know; on, it answers from the retrieved source. Ask a general question like “What is Cloudflare?” with RAG on and it falls back to the model's own knowledge."

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
