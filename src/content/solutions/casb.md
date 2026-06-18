---
title: "CASB"
blurb: "Discover every SaaS app in use, find risky configurations, surface shadow IT and shadow AI, and prevent sensitive data from leaking — all from an agentless API-based scan."
pillar: "sase"
order: 4

challenge:
  question: "Do you actually know which SaaS apps your employees are using — and what's inside them?"
  detail: "The average enterprise has hundreds of SaaS apps in use, only a fraction of which IT explicitly approved. Public Google Drive links share customer data with the world. Slack misconfigurations expose private channels. New AI tools appear weekly, with employees pasting source code and customer records into prompts. Each one is a potential data-breach vector — and most of them never crossed IT's desk."

solutionPoints:
  - title: "Agentless API scanning of sanctioned apps. "
    detail: "Connect Google Workspace, Microsoft 365, Salesforce, GitHub, Slack, Box, and 30+ other SaaS apps via OAuth. Cloudflare CASB continuously scans configurations, sharing settings, and user behavior to surface misconfigurations and risky data exposures."
  - title: "Shadow IT &amp; Shadow AI discovery. "
    detail: "Gateway logs identify every SaaS and AI app in use across your org, ranked by risk and adoption. Spot which teams are using which tools, see who's hitting unsanctioned AI sites, and decide what to sanction or block."
  - title: "Integrated Data Loss Prevention (DLP). "
    detail: "Pre-built detectors for PII, payment data, source code, secrets, and credentials. Or build custom detectors with regex, exact data match, or document fingerprinting. Apply DLP across Gateway HTTP traffic, CASB API findings, and isolated sessions."
  - title: "Remediate in-line. "
    detail: "Findings link directly into Gateway and DLP policies — block uploads to unsanctioned cloud storage, prevent specific data types from leaving managed apps, or isolate untrusted AI tools with paste disabled."
  - title: "One platform, one policy. "
    detail: "Instead of a separate CASB, SWG, DLP, and ZTNA console, every policy lives in Cloudflare Zero Trust — written once, applied consistently across DNS, HTTP, network, and app traffic."

faq:
  - question: "Does CASB require agents on user devices?"
    answer: "The API-based scan of sanctioned apps is fully agentless — it talks directly to the SaaS provider via OAuth. For in-line inspection (preventing uploads in real time), you use Gateway + WARP, which does require the WARP client or a tunnel."
  - question: "Can DLP find data that isn't a credit card or SSN?"
    answer: "Yes. Pre-built detectors cover the common categories, but you can also create custom detectors with regex, define exact-match datasets (your customer ID list, your secret key formats), or fingerprint specific documents and detect partial matches."
  - question: "What's the difference between shadow IT and shadow AI?"
    answer: "Shadow IT is any unsanctioned SaaS — file sharing, project management, finance tools. Shadow AI is the subset focused on AI/LLM tools where the risk profile is sharper: employees pasting sensitive data into prompts, models retaining inputs for training, and outputs leaving the organization's control."
  - question: "Can I block ChatGPT or Claude entirely?"
    answer: "Yes, but most customers don't want to. The recommended pattern is to allow them through Browser Isolation with paste/upload disabled — users can read responses, but can't paste sensitive data into the prompt."

demo:
  type: "coming-soon"

diveDeeper:
  docs:
    - title: "Cloudflare CASB overview"
      url: "https://developers.cloudflare.com/cloudflare-one/applications/scan-apps/"
    - title: "Data Loss Prevention (DLP)"
      url: "https://developers.cloudflare.com/cloudflare-one/policies/data-loss-prevention/"
    - title: "Shadow IT Discovery"
      url: "https://developers.cloudflare.com/cloudflare-one/insights/analytics/shadow-it/"
  blogs:
    - title: "Cloudflare One for AI"
      url: "https://blog.cloudflare.com/cloudflare-one-for-ai/"
    - title: "Detecting AI bots and DLP for AI"
      url: "https://blog.cloudflare.com/dlp-for-ai/"
---
