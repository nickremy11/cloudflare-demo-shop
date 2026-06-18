---
title: "Image Optimization"
blurb: "Resize, recompress, and reformat images on the fly. Serve WebP and AVIF to browsers that support them, smaller variants to mobile — all via URL parameters or a Worker."
pillar: "app-security"
order: 10

challenge:
  question: "Why are images still the slowest thing on your page?"
  detail: "Images are typically 60–80% of total page weight. Most teams upload a single high-resolution JPEG and let the browser deal with it — wasting bandwidth on mobile, missing out on AVIF/WebP, and never serving variants sized for the actual viewport. Building an offline pipeline to generate dozens of variants per asset is real engineering work; storing them all costs real money. The result: pages feel slow, especially on flaky mobile networks."

solutionPoints:
  - title: "On-the-fly resize and format conversion. "
    detail: "Append URL parameters (<code>width=600&amp;format=auto&amp;quality=80</code>) and Cloudflare returns the resized, recompressed, format-converted image. No pre-processing, no S3 of variants, no Lambda functions."
  - title: "Automatic format negotiation. "
    detail: "<code>format=auto</code> serves AVIF to browsers that accept it, WebP otherwise, original format as fallback. Typically 30–50% smaller than the original JPEG."
  - title: "Polish: zero-config compression. "
    detail: "For sites with images already hosted on your origin, Polish recompresses every cached image automatically — no URL changes required. Lossless and lossy modes available."
  - title: "Images binding (Workers). "
    detail: "Same image pipeline accessible from Workers via the Images binding. Transform any image in code, with full control over pipeline and caching."
  - title: "Cloudflare Images storage. "
    detail: "Optional paid tier that stores your image masters at Cloudflare and serves all variants from a per-image flat fee — no separate S3 + CDN math."

faq:
  - question: "Will <code>format=auto</code> break my older browsers?"
    answer: "No — Cloudflare checks the Accept header. Browsers that don't support AVIF get WebP, ones that don't support either get the original format."
  - question: "Does this work for images I don't control (third-party CDNs)?"
    answer: "Image Resizing requires the image to be on a domain proxied through Cloudflare, or fetched by a Worker. You can't directly transform an image hosted on another vendor's CDN — but you can fetch it via a Worker, transform it, and serve from your domain."
  - question: "What about animated GIFs and SVGs?"
    answer: "Animated GIFs can be converted to MP4 or WebM for huge size savings. SVGs are passed through (already vector). The transform pipeline handles JPEG, PNG, WebP, AVIF, GIF, and TIFF inputs."
  - question: "How does this differ from Cloudflare Images (the paid product)?"
    answer: "Image Resizing/Polish transforms images that already live on your origin. Cloudflare Images is a managed store-plus-serve product that hosts your masters and serves variants — useful when you don't want to manage image storage yourself."

demo:
  type: "coming-soon"

diveDeeper:
  docs:
    - title: "Image Resizing"
      url: "https://developers.cloudflare.com/images/transform-images/"
    - title: "Polish"
      url: "https://developers.cloudflare.com/images/polish/"
    - title: "Cloudflare Images"
      url: "https://developers.cloudflare.com/images/"
  blogs:
    - title: "AVIF and WebP at the edge"
      url: "https://blog.cloudflare.com/category/images/"
    - title: "Cloudflare Images: simple media optimization"
      url: "https://blog.cloudflare.com/cloudflare-images/"
---
