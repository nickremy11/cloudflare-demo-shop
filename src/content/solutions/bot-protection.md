---
title: "Bot Protection & Rate Limiting"
blurb: "Distinguish real users from scrapers, credential stuffers, and inventory hoarders, then challenge, block, or rate-limit automated abuse with controls matched to your Cloudflare plan."
pillar: "app-security"
order: 2

challenge:
  question: "How do you tell a real customer from an automated attacker pretending to be one?"
  detail: "Modern bots are sophisticated. They run real browsers via headless Chromium, rotate residential IPs, solve CAPTCHAs with cheap human labor or ML, and mimic human mouse movement. Block too aggressively and you lose conversions. Block too leniently and bots steal inventory (sneakers, concert tickets), stuff credentials, scrape pricing, or DDoS your login endpoint. Meanwhile, your origin pays for every request — bot or not."

diagram:
  src: "/diagrams/bot-management.png"
  alt: "Bot protection decision flow"
  caption: "Enterprise Bot Management assigns granular 1–99 scores; other plans use managed bot categories and actions."

solutionPoints:
  - title: "Protection on every plan. "
    detail: "Free zones can enable Bot Fight Mode's fixed computational challenge. Pro adds configurable Super Bot Fight Mode controls for definitely automated and verified traffic. Business adds likely-automated detection, while Enterprise Bot Management exposes the full 1–99 score and advanced signals."
  - title: "Multiple detection engines. "
    detail: "Cloudflare combines deterministic heuristics, machine learning, JavaScript detections, and verified-bot validation. Enterprise Bot Management adds domain-specific analysis and exposes JA3/JA4 fingerprints, detection IDs, signed-agent status, and other fields for precise policies."
  - title: "Verified bots and agents. "
    detail: "Cloudflare validates legitimate automation such as search crawlers, monitoring services, and signed agents. Paid plans provide explicit controls, and Enterprise Bot Management can target verified-bot categories or individual detections."
  - title: "Granular Enterprise policy. "
    detail: "Enterprise Bot Management customers can combine bot score and bot fields with path, IP, method, or other request properties in WAF custom rules, Workers, Transform Rules, rate limiting rules, analytics, and logs."
  - title: "Rate limiting as a second layer. "
    detail: "Rate limiting controls request frequency rather than classifying the requester. Available parameters vary by plan; Enterprise Bot Management signals can be combined with advanced rate limiting to slow credential stuffing, scraping, and inventory abuse without applying one threshold to every visitor."
  - title: "AI crawler controls on every plan. "
    detail: "All plans include behavior-based AI bot policies, AI Labyrinth, managed robots.txt, and AI Crawl Control for crawler visibility and per-crawler allow or block decisions. Enterprise Bot Management adds BotBase and business-impact attribution."

featureMatrix:
  component: "BotPlanMatrix"
  label: "Plan Comparison"
  heading: "Bot Fight Mode vs. Super Bot Fight Mode vs. Bot Management"
  note: "Four plan experiences, progressively deeper detection, control, and visibility. Enterprise zones without the Bot Management add-on receive the Business version of Super Bot Fight Mode."

faq:
  - question: "Will this affect good bots like Googlebot or Bingbot?"
    answer: "Cloudflare identifies verified bots and agents separately. Pro and Business customers can configure the Verified bots action in Super Bot Fight Mode; Enterprise Bot Management customers can use <code>cf.bot_management.verified_bot</code>, verified-bot categories, or detection IDs in custom rules. Bot Fight Mode on Free has no explicit verified-bot control, so review Security Events for false positives."
  - question: "How is bot management different from rate limiting?"
    answer: "Bot management classifies *what* the requester is. Rate limiting controls *how often* anyone can do something. They're complementary — you typically use bot management to challenge or block obvious bots, and rate limiting to catch credential-stuffing or scraping attempts that slip through with low-volume distributed requests."
  - question: "What if my real users score low?"
    answer: "A score below 30 means automated or likely automated, but legitimate application, mobile, proxy, or privacy-focused traffic can still score low. Enterprise Bot Management customers should first analyze score distribution, deploy narrow log rules, and tune by path and traffic type before using a terminating action. Super Bot Fight Mode customers can review Security Events and add a WAF Skip exception; Bot Fight Mode cannot be skipped."
  - question: "Does this also stop the AI scrapers training on my content?"
    answer: "Cloudflare provides AI bot policies on every plan for Search, Agent, and Training behaviors, including verified and additional unverified bots in those classifications. AI Crawl Control can allow or block individual crawlers, AI Labyrinth targets crawlers that ignore no-crawl guidance, and managed robots.txt expresses your preferences. robots.txt is advisory; use a blocking policy when enforcement is required."

demo:
  type: "interactive"
  component: "BotRateDemo"
  note: "Your current request's Enterprise Bot Management score is shown below when available (copied into a custom demo cookie by the site middleware). Hit the rate-limit endpoint repeatedly to trigger a 429."

diveDeeper:
  docs:
    - title: "Bot protection plans"
      url: "https://developers.cloudflare.com/bots/plans/"
    - title: "Bot solutions overview"
      url: "https://developers.cloudflare.com/bots/"
    - title: "Bot Management variables"
      url: "https://developers.cloudflare.com/bots/reference/bot-management-variables/"
    - title: "AI Crawl Control"
      url: "https://developers.cloudflare.com/ai-crawl-control/"
    - title: "Rate Limiting rules"
      url: "https://developers.cloudflare.com/waf/rate-limiting-rules/"
    - title: "Bot score concepts"
      url: "https://developers.cloudflare.com/bots/concepts/bot-score/"
  blogs:
    - title: "Declaring your AIndependence: block AI bots"
      url: "https://blog.cloudflare.com/declaring-your-aindependence-block-ai-bots-scrapers-and-crawlers-with-a-single-click/"
    - title: "How Cloudflare's bot management ML works"
      url: "https://blog.cloudflare.com/how-cloudflare-mitigated-yet-another-okta-compromise/"
  blogTag:
    slug: "bot-management"
    label: "Bot Management"
lastVerified: "2026-09-08"
sources:
  - "https://developers.cloudflare.com/bots/plans/"
  - "https://developers.cloudflare.com/bots/plans/free/"
  - "https://developers.cloudflare.com/bots/plans/pro/"
  - "https://developers.cloudflare.com/bots/plans/biz-and-ent/"
  - "https://developers.cloudflare.com/bots/plans/bm-subscription/"
  - "https://developers.cloudflare.com/bots/bot-analytics/"
  - "https://developers.cloudflare.com/bots/botbase/"
  - "https://developers.cloudflare.com/bots/attribution-business-insights/"
  - "https://developers.cloudflare.com/bots/concepts/feedback-loop/"
  - "https://developers.cloudflare.com/bots/reference/alerts/"
  - "https://developers.cloudflare.com/bots/account-abuse-protection/"
  - "https://developers.cloudflare.com/bots/reference/bot-management-variables/"
  - "https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/"
  - "https://developers.cloudflare.com/ai-crawl-control/"
  - "https://developers.cloudflare.com/waf/rate-limiting-rules/"
---
