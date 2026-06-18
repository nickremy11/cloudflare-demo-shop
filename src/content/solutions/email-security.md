---
title: "Email Security"
blurb: "Stop phishing, business email compromise, and malicious attachments before they hit the inbox. Cloudflare Email Security (formerly Area 1) inspects every message and can retract delivered emails post-incident."
pillar: "sase"
order: 5

challenge:
  question: "Why does phishing keep getting through, and what happens when it does?"
  detail: "Email remains the #1 initial-access vector for ransomware, account takeover, wire fraud, and supply-chain compromise. Native filters in Microsoft 365 and Google Workspace catch the obvious spam — but business email compromise (BEC), credential phishing on lookalike domains, and zero-day attachments routinely slip past. Once delivered, the clock is ticking on someone clicking the link or wiring the money."

solutionPoints:
  - title: "Pre-delivery inspection at machine speed. "
    detail: "Cloudflare Email Security inspects every message before it lands in the inbox: sender reputation, content analysis, URL detonation, attachment sandboxing, and ML-based BEC detection. Bad mail never arrives."
  - title: "Domain impersonation &amp; BEC detection. "
    detail: "Models trained on billions of messages flag executive-impersonation, look-alike domains (cl0udflare.com vs cloudflare.com), and conversation hijacking — the cases that DKIM/SPF/DMARC alone don't catch."
  - title: "Post-delivery retraction. "
    detail: "If a threat is identified after delivery (intel updates, user reports, IOC matches), Cloudflare can remove the message from every inbox it reached. No 'please don't click that email' all-staff."
  - title: "Easy deployment. "
    detail: "Inline via MX record change, or API-based add-on for Microsoft 365 / Google Workspace that requires no MX changes. Onboard in minutes."
  - title: "One platform with the rest of Cloudflare One. "
    detail: "Indicators detected in email feed back into Gateway, Access, and CASB — so a URL flagged in a phishing email is automatically blocked across the entire org's web traffic too."

faq:
  - question: "We already have Microsoft Defender / Proofpoint. Why add this?"
    answer: "Most customers deploy Cloudflare Email Security as a layered defense in front of (or alongside) native filters. Cloudflare's models catch a substantial fraction of BEC and targeted phishing that slipped past the existing layer — measured directly in customer environments."
  - question: "Will this slow down email delivery?"
    answer: "No. Inline mode adds typically &lt;1s of inspection latency. The API-based deployment for M365/Google Workspace inspects messages just after they hit Microsoft's or Google's servers, with no impact on transit time."
  - question: "What about emails sent to mobile devices?"
    answer: "Email Security runs in the cloud at the mail flow layer — it's independent of the device. Whether users read mail on the iPhone Mail app, Outlook desktop, or webmail, the protection is the same."
  - question: "How is this different from Cloudflare Email Routing (the free product)?"
    answer: "Email Routing is a free service that forwards email for domains you own (e.g. me@mydomain.com → mygmail@gmail.com). Email Security is the enterprise threat-protection product that inspects, classifies, and quarantines malicious messages. Different products."

demo:
  type: "coming-soon"

diveDeeper:
  docs:
    - title: "Cloudflare Email Security overview"
      url: "https://developers.cloudflare.com/cloudflare-one/email-security/"
    - title: "Deployment guides"
      url: "https://developers.cloudflare.com/cloudflare-one/email-security/deployment/"
  blogs:
    - title: "Email is the top attack vector — here's how we protect ours"
      url: "https://blog.cloudflare.com/spotlight-on-zero-trust-week-2023/"
    - title: "Cloudflare named a Leader in email security"
      url: "https://blog.cloudflare.com/category/email-security/"
---
