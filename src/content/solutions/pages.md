---
title: "Pages"
blurb: "Build, preview, and deploy modern frontend apps — Next.js, Astro, Remix, SvelteKit, plain HTML — straight from your Git repository. Global edge delivery and Functions included."
pillar: "developer"
order: 5

challenge:
  question: "How do you deploy a modern web app without owning a build pipeline and a CDN?"
  detail: "A 'simple' static site today involves a Git repo, a CI runner, a build process, a CDN, preview environments per PR, a custom domain config, SSL renewal, redirects, headers, and probably some serverless functions for forms and APIs. Stitching that together yourself takes weeks. Hiring a build-and-deploy specialist takes more. Most teams use Vercel or Netlify — and then run into vendor lock-in, surprise bandwidth bills, or limits that didn't exist last quarter."

solutionPoints:
  - title: "Git push → live in seconds. "
    detail: "Connect a GitHub or GitLab repo, choose a build command, and Pages builds and deploys every commit. Production deploys on <code>main</code>, unique preview URLs on every other branch and pull request."
  - title: "Framework-aware builds. "
    detail: "Auto-detects Next.js, Astro, SvelteKit, Remix, Nuxt, Vue, Vite, Hugo, Jekyll, Gatsby, and dozens more. Static, SSR, and hybrid output all supported."
  - title: "Pages Functions = Workers. "
    detail: "Drop <code>.ts</code> files in a <code>/functions</code> folder and they become Worker routes. Same runtime, same bindings (R2, D1, KV, AI). This very site is built that way — Astro static output plus Hono in <code>/functions</code>."
  - title: "Global edge delivery. "
    detail: "Every deploy is served from Cloudflare's 330+ city network with HTTP/3, automatic TLS, smart compression, and immutable asset caching."
  - title: "Generous free tier. "
    detail: "Unlimited bandwidth, unlimited requests, unlimited sites, 500 builds/month, free preview URLs. Pages is genuinely free for personal projects and small teams — without the bandwidth-bill anxiety."

faq:
  - question: "What's the difference between Pages and just deploying to Workers?"
    answer: "Pages is the experience layer for full-site deployments: Git integration, build pipelines, framework detection, preview URLs, redirects/headers config, etc. Underneath, your static assets are served from Cloudflare's CDN and your Functions run as Workers. Workers is the lower-level primitive; Pages is the opinionated, end-to-end developer experience."
  - question: "Does Pages charge for bandwidth?"
    answer: "No. Static asset delivery is unlimited, free. You're charged only if your Functions exceed the Workers paid-plan thresholds (10M+ requests/month, and only on the paid plan)."
  - question: "Can I use my existing CI/build setup instead of Pages' built-in builder?"
    answer: "Yes. Use Direct Upload (CLI or API) to upload pre-built assets. This is useful if you have a custom build runner, monorepo orchestration, or compliance requirements about the build environment."
  - question: "What about preview environments per PR?"
    answer: "Built in. Every branch (and every commit on every branch) gets a unique URL. Pull requests get auto-commented with the preview link. Configurable per environment (different env vars, different Functions bindings) for staging vs production."

demo:
  type: "coming-soon"

diveDeeper:
  docs:
    - title: "Cloudflare Pages overview"
      url: "https://developers.cloudflare.com/pages/"
    - title: "Pages Functions"
      url: "https://developers.cloudflare.com/pages/functions/"
    - title: "Framework guides"
      url: "https://developers.cloudflare.com/pages/framework-guides/"
  blogs:
    - title: "Pages is now generally available"
      url: "https://blog.cloudflare.com/cloudflare-pages-goes-full-stack/"
    - title: "Building this site on Pages + Workers"
      url: "https://blog.cloudflare.com/full-stack-cloudflare-with-remix-and-supabase/"
---
