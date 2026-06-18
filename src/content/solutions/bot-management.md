---
title: "Bot Management & Rate Limiting"
blurb: "Distinguish real users from scrapers, credential stuffers, and inventory hoarders with machine-learning bot scores — then rate-limit, challenge, or block based on policy."
pillar: "app-security"
order: 2

challenge:
  question: "How do you tell a real customer from an automated attacker pretending to be one?"
  detail: "Modern bots are sophisticated. They run real browsers via headless Chromium, rotate residential IPs, solve CAPTCHAs with cheap human labor or ML, and mimic human mouse movement. Block too aggressively and you lose conversions. Block too leniently and bots steal inventory (sneakers, concert tickets), stuff credentials, scrape pricing, or DDoS your login endpoint. Meanwhile, your origin pays for every request — bot or not."

diagram:
  src: "/diagrams/bot-management.png"
  alt: "Bot management decision flow"
  caption: "Every request gets a 1–99 bot score; policies decide what to do with each band."

solutionPoints:
  - title: "Machine-learning bot scores. "
    detail: "Every request gets a score from 1 (definitely bot) to 99 (definitely human). The model is trained on traffic from millions of sites globally — Cloudflare sees roughly 20% of the entire web."
  - title: "Behavioral &amp; JA3/JA4 fingerprinting. "
    detail: "Beyond IP and user-agent, Cloudflare evaluates TLS fingerprints, HTTP/2 frame ordering, and behavioral signals (mouse, scroll, timing) when JS detections fire. Bots that perfectly mimic Chrome still fail these checks."
  - title: "Verified bots are first-class citizens. "
    detail: "Cloudflare maintains a list of good bots (Googlebot, Bingbot, monitoring tools, RSS readers). They're allowed by default and tagged separately, so you can write rules like 'block all bots except verified ones.'"
  - title: "Rate limiting on any signal. "
    detail: "Limit by IP, by cookie, by JA3, by header, by URL pattern. Use sliding windows, configurable thresholds, and action gradients (challenge → JS challenge → block). Stop credential stuffing without locking out real users."
  - title: "Surgical actions. "
    detail: "Block, JS-challenge, managed challenge (Turnstile), rate-limit, log, or skip — picked per rule. Combine with WAF rules for layered defense (e.g. 'rate-limit logins to 5/min AND challenge on bot score &lt; 30')."

faq:
  - question: "Will this affect good bots like Googlebot or Bingbot?"
    answer: "No. Cloudflare maintains a curated list of verified bots, and they're tagged with <code>cf.client.bot</code>. Default rules let verified bots through; you write your blocks to apply only to <code>cf.bot_management.score &lt; 30 AND NOT cf.client.bot</code>. Search engines, RSS aggregators, and monitoring services keep working."
  - question: "How is bot management different from rate limiting?"
    answer: "Bot management classifies *what* the requester is. Rate limiting controls *how often* anyone can do something. They're complementary — you typically use bot management to challenge or block obvious bots, and rate limiting to catch credential-stuffing or scraping attempts that slip through with low-volume distributed requests."
  - question: "What if my real users score low?"
    answer: "It happens — privacy-focused browsers, ad blockers, or unusual networks can produce lower scores. Best practice is to start in log mode, examine the score distribution for your real traffic, and tune thresholds. Most customers find &lt;30 is a safe 'definitely bot' band."
  - question: "Does this also stop the AI scrapers training on my content?"
    answer: "Yes. Cloudflare ships a one-click 'Block AI Scrapers' rule that uses bot scores, JA fingerprints, and a curated list of AI crawler identifiers (GPTBot, ClaudeBot, PerplexityBot, etc.) — and ML detection for the ones lying about who they are."

demo:
  type: "interactive"
  component: "BotRateDemo"
  note: "Your current request's bot management score is shown below (injected by the site middleware). Hit the rate-limit endpoint repeatedly to trigger a 429."

diveDeeper:
  docs:
    - title: "Bot Management overview"
      url: "https://developers.cloudflare.com/bots/"
    - title: "Rate Limiting rules"
      url: "https://developers.cloudflare.com/waf/rate-limiting-rules/"
    - title: "Bot score concepts"
      url: "https://developers.cloudflare.com/bots/concepts/bot-score/"
  blogs:
    - title: "Declaring your AIndependence: block AI bots"
      url: "https://blog.cloudflare.com/declaring-your-aindependence-block-ai-bots-scrapers-and-crawlers-with-a-single-click/"
    - title: "How Cloudflare's bot management ML works"
      url: "https://blog.cloudflare.com/how-cloudflare-mitigated-yet-another-okta-compromise/"
---
