---
title: "Workers — Edge Computing"
blurb: "Serverless JavaScript, TypeScript, Python, and WASM running in every Cloudflare location worldwide. Cold starts measured in milliseconds. Pay per request, not per idle hour."
pillar: "developer"
order: 1

challenge:
  question: "Why is your code running in one region when your users are everywhere?"
  detail: "Centralized serverless (AWS Lambda, GCP Functions) runs in a single region. Users in other regions pay round-trip latency on every request. Cold starts add hundreds of milliseconds because containers have to spin up. Pricing models charge for memory you reserved, not memory you used. Building globally-fast applications means juggling multi-region deployments, custom edge caching, and complex routing — when really you just want to run a function close to the user."

solutionPoints:
  - title: "Run in 330+ locations automatically. "
    detail: "Deploy once, and your Worker runs in every Cloudflare data center worldwide. The request goes to the nearest one. No regions to pick, no replication to manage."
  - title: "V8 isolates instead of containers. "
    detail: "Workers run in V8 isolates — the same sandbox model Chrome uses for tabs. Cold start is measured in single-digit milliseconds (vs hundreds for container-based serverless). No cold start tax on irregular traffic."
  - title: "JavaScript, TypeScript, Python, WASM. "
    detail: "Native runtime for JS and TypeScript. Python via Pyodide. Any language that compiles to WebAssembly (Rust, Go, C++, etc.) runs unmodified."
  - title: "First-class platform integrations. "
    detail: "Workers bind directly to R2, KV, D1, Durable Objects, Workers AI, Queues, and Vectorize — no SDK auth, no HTTP overhead. Sub-millisecond access to platform storage."
  - title: "Pay per request. "
    detail: "$0.30 per million requests on the paid plan. No idle compute charges. Free tier covers 100k requests/day forever, which is enough for many real applications."

faq:
  - question: "What can't I do in a Worker?"
    answer: "Workers can't open raw TCP sockets to non-HTTP services (use Hyperdrive for databases, TCP/UDP sockets for specific cases). They have a 30s CPU time limit per invocation (configurable up to 5 min on paid plans). They can't write to a filesystem (use R2 or KV). Outside those edges, anything you'd build on Node.js you can build on Workers."
  - question: "How is this different from AWS Lambda@Edge or CloudFront Functions?"
    answer: "Lambda@Edge runs in CloudFront regional edge caches (a dozen or so locations) and has multi-second cold starts. CloudFront Functions runs everywhere but only allows 1ms of CPU and very limited capabilities. Workers runs everywhere AND has 30s of CPU budget AND has full JS runtime AND has bindings to KV/R2/D1/AI. It's a category beyond what edge functions offered until recently."
  - question: "Can Workers talk to my existing origin or database?"
    answer: "Yes. Workers can fetch any URL (your origin in AWS, your SaaS API, anywhere). For databases, Hyperdrive provides pooled, accelerated connections to Postgres/MySQL from Workers without exhausting connection limits."
  - question: "What about long-running tasks or scheduled jobs?"
    answer: "Workflows (durable execution) handle long-running multi-step tasks with automatic retries. Cron Triggers run Workers on a schedule. Queues let one Worker enqueue work that another Worker consumes. All built into the platform."

demo:
  type: "interactive"
  component: "WorkersAiDemo"
  note: "This site itself is built on Workers/Pages — but here's a quick LLM call running via Workers AI through this site's existing Worker pipeline."

diveDeeper:
  docs:
    - title: "Cloudflare Workers overview"
      url: "https://developers.cloudflare.com/workers/"
    - title: "Workers runtime APIs"
      url: "https://developers.cloudflare.com/workers/runtime-apis/"
    - title: "Workers bindings"
      url: "https://developers.cloudflare.com/workers/runtime-apis/bindings/"
  blogs:
    - title: "Workers AI is generally available"
      url: "https://blog.cloudflare.com/workers-ai-ga/"
    - title: "Workers vs. Lambda — performance benchmarks"
      url: "https://blog.cloudflare.com/serverless-performance-comparison-workers-lambda/"
---
