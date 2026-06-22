---
title: "Durable Objects"
blurb: "Single-instance, strongly-consistent compute with built-in SQLite storage and WebSockets — perfect for chat rooms, multiplayer state, real-time collaboration, and per-tenant coordination."
pillar: "developer"
order: 6

challenge:
  question: "How do you build real-time, stateful systems on a stateless platform?"
  detail: "Serverless functions are stateless by design — every request might land on a different instance. That works great for HTTP APIs but breaks down the moment you need to coordinate state: a chat room with 50 users, a multiplayer game lobby, a real-time document editor, per-tenant rate limiters, a queue with strict ordering. The usual answer is 'put a Redis cluster in front and deal with the connection management.' That's a lot of moving parts."

solutionPoints:
  - title: "One instance per object, globally. "
    detail: "Each Durable Object is a single instance globally — addressed by ID. All requests to that ID go to the same instance, so state is locally consistent without distributed-locking. Cloudflare migrates instances to where the traffic is."
  - title: "Built-in SQLite storage. "
    detail: "Each DO has a transactional SQLite database persistent across restarts. Sub-millisecond queries from inside the Object. No external database needed for per-tenant state."
  - title: "WebSockets and hibernation. "
    detail: "Native WebSocket support with hibernation — your DO can hold thousands of WebSocket connections without consuming CPU. Pay only when work actually happens, even for sites that need persistent connections."
  - title: "Alarms for scheduled work. "
    detail: "Schedule a DO to wake up at a future time. Cron-per-object: 'remind users 24h before their event,' 'cleanup stale game lobbies every 5min,' 'flush metrics buffer hourly.' All inside the same DO instance."
  - title: "Sharded by you, not by cluster ops. "
    detail: "Want one DO per chat room? One per user? One per game? Pick your own sharding key. No re-sharding event when you scale — each ID is automatically routed to its own instance."

faq:
  - question: "When should I use a Durable Object vs. D1 or KV?"
    answer: "D1 for relational queries across many users. KV for global read-heavy data. Durable Objects for single-writer-per-key consistency, real-time coordination, or stateful per-entity logic. A chat room is a DO; the list of all chat rooms is in D1; the read-only assets are in KV/R2."
  - question: "What's the difference between a DO and a Worker?"
    answer: "A Worker is stateless and runs anywhere globally on any node. A DO is stateful — one instance per ID, with attached storage. Workers handle the high-volume request layer; DOs handle the stateful coordination layer. They work together: a Worker receives the request, finds the right DO, and forwards."
  - question: "How does DO billing work?"
    answer: "Per request (similar to Workers) plus per-millisecond of active CPU. WebSocket hibernation means you don't pay for idle connections. Storage is billed per GB-month. For most use cases, DOs cost a fraction of what a managed Redis or DynamoDB cluster would."
  - question: "Where does my DO run?"
    answer: "Cloudflare locates each DO instance close to where its traffic comes from, and migrates it if traffic patterns shift. You don't pick a region — the platform handles it."

demo:
  type: "interactive"
  component: "ChatRoomDemo"
  note: "Open this page in two browser tabs to see real-time sync. Each tab is a separate user; the room is one shared Durable Object instance."

diveDeeper:
  docs:
    - title: "Durable Objects overview"
      url: "https://developers.cloudflare.com/durable-objects/"
    - title: "DO storage API"
      url: "https://developers.cloudflare.com/durable-objects/api/storage-api/"
    - title: "WebSockets in DOs"
      url: "https://developers.cloudflare.com/durable-objects/best-practices/websockets/"
  blogs:
    - title: "Durable Objects: serverless state for real-time apps"
      url: "https://blog.cloudflare.com/introducing-workers-durable-objects/"
    - title: "WebSocket hibernation: persistent connections at cheap cost"
      url: "https://blog.cloudflare.com/workers-durable-objects-easy-mode/"
---
