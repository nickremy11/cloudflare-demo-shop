---
title: "Cloud Storage — D1, R2, KV"
blurb: "Three storage products, one platform: D1 for SQL, R2 for objects with $0 egress, KV for global key-value reads. Wire them to Workers in one line each."
pillar: "developer"
order: 3

challenge:
  question: "Why is your storage bill mostly egress?"
  detail: "Object storage is cheap to put in (S3 is $0.023/GB-month). The killer is moving data out: S3 egress is $0.09/GB to the internet — five orders of magnitude more than storage itself. Add per-operation fees, multi-region replication costs, and the engineering overhead of connecting a centralized database to edge code, and your 'cheap' cloud-storage stack quickly becomes very expensive and very slow."

solutionPoints:
  - title: "R2 — object storage with zero egress. "
    detail: "S3-compatible API. No egress fees, ever — read your data out as many times as you want, for free. Pay for storage and operations only. The platform foundation for AI training data, media, backups, and static assets."
  - title: "D1 — serverless SQL at the edge. "
    detail: "SQLite-compatible relational database with horizontal read replicas across Cloudflare's edge. Sub-millisecond queries from Workers. Time-travel back to any point in the last 30 days. Free tier and per-row pricing."
  - title: "KV — global key-value reads. "
    detail: "Globally replicated key-value store. Writes propagate worldwide in seconds, reads are cached at the edge for fast access. Perfect for config, feature flags, session tokens, and cached data."
  - title: "Direct Worker bindings. "
    detail: "<code>env.MY_BUCKET.put()</code>, <code>env.MY_DB.prepare()</code>, <code>env.MY_KV.get()</code> — no SDK auth, no HTTP overhead. Storage operations from Workers are sub-millisecond."
  - title: "Durable Objects for stateful coordination. "
    detail: "When you need single-writer-per-key consistency (chat rooms, game state, real-time collaboration), Durable Objects pair with R2/D1 to provide strong consistency on top of edge storage. See its own solution page."

faq:
  - question: "Is R2 really free egress, no asterisks?"
    answer: "Yes. R2 charges for storage ($0.015/GB-month) and operations (writes are more expensive than reads), but zero per-byte egress fees. Most customers see 5–10× savings vs S3 once you account for the egress they were paying for. The pricing calculator in the demo below shows the math."
  - question: "When should I use D1 vs KV?"
    answer: "D1 if you need relational queries, joins, transactions, or complex schemas. KV if you have a flat key-to-value lookup, eventually-consistent reads are acceptable, and you want maximum read performance globally. Many apps use both: D1 for the system of record, KV for cached or derived data."
  - question: "Is D1 production-ready?"
    answer: "D1 is GA. Read replicas, point-in-time recovery, and proper backups are all available. Single-database write throughput has well-documented limits; for write-heavy workloads, Durable Objects or sharded D1 are the patterns."
  - question: "How do I migrate from S3 to R2?"
    answer: "R2 has Super Slurper — an automated migration tool that copies your S3 bucket to R2 in the background, with delta sync. Also, R2 implements the S3 API, so you can often just point your existing S3 client at R2 by changing the endpoint."

demo:
  type: "interactive"
  component: "R2Demo"
  note: "Upload a file to R2 (as guest with email, or via Cloudflare Access auth). Malicious-content detection scans every upload. Pricing calculator compares R2 storage and egress vs S3, GCS, Azure, and Vercel."

diveDeeper:
  docs:
    - title: "R2 object storage"
      url: "https://developers.cloudflare.com/r2/"
    - title: "D1 SQL database"
      url: "https://developers.cloudflare.com/d1/"
    - title: "KV key-value store"
      url: "https://developers.cloudflare.com/kv/"
  blogs:
    - title: "R2 launches — $0 egress"
      url: "https://blog.cloudflare.com/introducing-r2-object-storage/"
    - title: "D1 is generally available"
      url: "https://blog.cloudflare.com/making-full-stack-easier-with-d1-ga-hyperdrive-queues/"
---
