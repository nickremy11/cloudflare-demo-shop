---
title: "Email"
blurb: "Send transactional email, route inbound mail to your team, and stop phishing before it hits the inbox — all on Cloudflare. Email Sending and Email Routing handle the mail flow; Email Security (formerly Area 1) inspects every message and can retract delivered emails post-incident."
pillar: "sase"
order: 5

challenge:
  question: "Why is 'just send an email' still hard, and why does phishing keep getting through?"
  detail: "Teams need to send transactional mail (receipts, verification codes, alerts) and route inbound mail (support@, sales@) without standing up and maintaining SMTP infrastructure — SPF/DKIM/DMARC, bounce handling, deliverability. At the same time, email remains the #1 initial-access vector for ransomware, account takeover, wire fraud, and supply-chain compromise. Native filters in Microsoft 365 and Google Workspace catch the obvious spam, but business email compromise (BEC), credential phishing on lookalike domains, and zero-day attachments routinely slip past. Once delivered, the clock is ticking on someone clicking the link or wiring the money."

solutionPoints:
  - title: "Email Sending — transactional email, no mail server. "
    detail: "Call env.EMAIL.send() from a Worker (or use the REST API / authenticated SMTP) to send receipts, magic links, and alerts from a domain you already onboarded to Cloudflare. DKIM/DMARC signing, delivery logs, and bounce handling are built in."
  - title: "Email Routing — inbound mail without a mailbox to run. "
    detail: "Route mail sent to addresses on your domain (support@, sales@) to a verified inbox, or to a Worker for custom logic — forward, auto-reply, or process programmatically. No mail server to patch or scale."
  - title: "Pre-delivery inspection at machine speed. "
    detail: "Cloudflare Email Security inspects every message before it lands in the inbox: sender reputation, content analysis, URL detonation, attachment sandboxing, and ML-based BEC detection. Bad mail never arrives."
  - title: "Domain impersonation &amp; BEC detection. "
    detail: "Models trained on billions of messages flag executive-impersonation, look-alike domains (cl0udflare.com vs cloudflare.com), and conversation hijacking — the cases that DKIM/SPF/DMARC alone don't catch."
  - title: "Post-delivery retraction. "
    detail: "If a threat is identified after delivery (intel updates, user reports, IOC matches), Cloudflare can remove the message from every inbox it reached. No 'please don't click that email' all-staff."
  - title: "One platform with the rest of Cloudflare One. "
    detail: "Indicators detected by Email Security feed back into Gateway, Access, and CASB — so a URL flagged in a phishing email is automatically blocked across the entire org's web traffic too."

faq:
  - question: "Is Email Sending / Email Routing the same product as Email Security?"
    answer: "No — different products on the same platform. Email Sending and Email Routing (this demo) handle the mail flow: sending transactional email and routing inbound mail to inboxes or Workers. Email Security is the enterprise threat-protection product that inspects, classifies, and quarantines malicious messages before or after delivery. Many customers use both."
  - question: "Do I need my own mail server to use Email Sending or Email Routing?"
    answer: "No. Both run entirely on Cloudflare's platform. Email Sending uses a Workers binding, REST API, or authenticated SMTP; Email Routing forwards inbound mail to a verified address or a Worker. DNS (MX, SPF, DKIM) is configured automatically when you onboard the domain."
  - question: "We already have Microsoft Defender / Proofpoint. Why add Email Security?"
    answer: "Most customers deploy Cloudflare Email Security as a layered defense in front of (or alongside) native filters. Cloudflare's models catch a substantial fraction of BEC and targeted phishing that slipped past the existing layer — measured directly in customer environments."
  - question: "Will Email Security slow down email delivery?"
    answer: "No. Inline mode adds typically &lt;1s of inspection latency. The API-based deployment for M365/Google Workspace inspects messages just after they hit Microsoft's or Google's servers, with no impact on transit time."
  - question: "Can I use Email Sending for marketing or bulk email?"
    answer: "No — Email Sending is intended for transactional email (receipts, verification, notifications), not marketing or bulk sends."

demo:
  type: "interactive"
  component: "EmailDemo"
  note: "This demo exercises Email Sending and Email Routing end-to-end. Email Security (phishing/BEC inspection) isn't part of the live demo — see the solution points above for that half of the platform."

diveDeeper:
  docs:
    - title: "Cloudflare Email Service overview"
      url: "https://developers.cloudflare.com/email-service/"
    - title: "Send emails (Workers API, REST API, SMTP)"
      url: "https://developers.cloudflare.com/email-service/api/send-emails/"
    - title: "Route emails to inboxes or Workers"
      url: "https://developers.cloudflare.com/email-service/api/route-emails/"
    - title: "Cloudflare Email Security overview"
      url: "https://developers.cloudflare.com/cloudflare-one/email-security/"
  blogs:
    - title: "Email is the top attack vector — here's how we protect ours"
      url: "https://blog.cloudflare.com/spotlight-on-zero-trust-week-2023/"
    - title: "Cloudflare named a Leader in email security"
      url: "https://blog.cloudflare.com/category/email-security/"
---
