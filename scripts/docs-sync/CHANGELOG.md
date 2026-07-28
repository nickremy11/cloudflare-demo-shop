# docs-sync run log

Local record of every docs-sync run, newest first. Not part of the Astro site build (lives under scripts/docs-sync/, outside src/content and public/) — this is for your own reference, not published.

## 2026-07-28 (manual revert)

The five runs below this entry were manual `/run?force=true&slug=waf` tests
while debugging docs-sync-worker (fixing the `response_format.json_schema`
key name and the `env.EMAIL.send` field name — see git history). The last one
succeeded and passed grounding, but the generated copy was noticeably weaker
than the hand-written original (generic, repetitive paraphrasing of the docs
instead of specific, detail-rich sales copy) — accurate, but a real quality
regression. `src/content/solutions/waf.md` has been manually reverted to its
pre-test content in this commit. The pipeline itself is confirmed working
end-to-end (fetch → generate → verify → commit → email); the prompt likely
needs further tuning for copy quality before trusting unattended runs against
the rest of the catalog.

## 2026-07-28T13:17:01.699Z

## Weekly Cloudflare docs sync

Ran 2026-07-28T13:17:01.699Z against 1 solution(s).

### Changes
- **waf**: ✅ updated (blurb, solutionPoints, faq, diveDeeper.docs) from 3 source doc(s), 3 citation(s) verified against live docs

---
_Generated copy is only accepted when every non-obvious claim is backed by a verbatim quote from the cited developers.cloudflare.com page (see `verifyGrounding` in docs-sync-worker/src/index.ts). Anything that fails that check, or drifts too far in length from the current copy, is left untouched and flagged above for manual review instead of being force-applied._

---

## 2026-07-28T13:13:09.929Z

## Weekly Cloudflare docs sync

Ran 2026-07-28T13:13:09.929Z against 1 solution(s).

### Changes
- **waf**: ⚠️ source docs changed but the grounding check failed — left as-is
  - citation quote not found verbatim in https://developers.cloudflare.com/waf/managed-rules/: "Cloudflare provides pre-configured managed rulesets that protect against web app..."

---
_Generated copy is only accepted when every non-obvious claim is backed by a verbatim quote from the cited developers.cloudflare.com page (see `verifyGrounding` in docs-sync-worker/src/index.ts). Anything that fails that check, or drifts too far in length from the current copy, is left untouched and flagged above for manual review instead of being force-applied._

---

## 2026-07-28T13:12:39.112Z

## Weekly Cloudflare docs sync

Ran 2026-07-28T13:12:39.112Z against 1 solution(s).

### Changes
- **waf**: ⚠️ source docs changed but the grounding check failed — left as-is
  - citation quote not found verbatim in https://developers.cloudflare.com/waf/managed-rules/: "Cloudflare provides pre-configured managed rulesets that protect against web app..."

---
_Generated copy is only accepted when every non-obvious claim is backed by a verbatim quote from the cited developers.cloudflare.com page (see `verifyGrounding` in docs-sync-worker/src/index.ts). Anything that fails that check, or drifts too far in length from the current copy, is left untouched and flagged above for manual review instead of being force-applied._

---

## 2026-07-28T13:10:39.694Z

## Weekly Cloudflare docs sync

Ran 2026-07-28T13:10:39.694Z against 1 solution(s).

### Changes
- **waf**: ⚠️ source docs changed but generation/validation failed — left as-is (5024: JSON Model couldn't be met)

---
_Generated copy is only accepted when every non-obvious claim is backed by a verbatim quote from the cited developers.cloudflare.com page (see `verifyGrounding` in docs-sync-worker/src/index.ts). Anything that fails that check, or drifts too far in length from the current copy, is left untouched and flagged above for manual review instead of being force-applied._

---

## 2026-07-28T13:06:15.474Z

## Weekly Cloudflare docs sync

Ran 2026-07-28T13:06:15.474Z against 1 solution(s).

### Changes
- **waf**: ⚠️ source docs changed but generation/validation failed — left as-is (5024: JSON Model couldn't be met)

### Related Cloudflare changelog activity this week
- [WAF - WAF Release - 2026-07-21](https://developers.cloudflare.com/changelog/post/2026-07-21-waf-release/) — related to `waf`
- [WAF - WAF Release - Scheduled changes for 2026-07-27](https://developers.cloudflare.com/changelog/post/scheduled-waf-release/) — related to `waf`
- [WAF - WAF Release - 2026-07-17 - Emergency](https://developers.cloudflare.com/changelog/post/2026-07-17-emergency-waf-release/) — related to `waf`

### New Cloudflare blog posts that might be worth a look
_Informational only — never auto-added to `diveDeeper.blogs`. Review and add manually if relevant._
- [Cloudflare WAF proactively protects against React vulnerability](https://blog.cloudflare.com/waf-rules-react-vulnerability/) — tagged "Web Application Firewall", relevant to `waf`
- [One IP address, many users: detecting CGNAT to reduce collateral effects](https://blog.cloudflare.com/detecting-cgn-to-reduce-collateral-damage/) — tagged "Web Application Firewall", relevant to `waf`
- [Cloudflare named a leader in Web Application Firewall Solutions in 2025 Forrester report](https://blog.cloudflare.com/cloudflare-named-leader-waf-forrester-2025/) — tagged "Web Application Firewall", relevant to `waf`

---
_Generated copy is only accepted when every non-obvious claim is backed by a verbatim quote from the cited developers.cloudflare.com page (see `verifyGrounding` in docs-sync-worker/src/index.ts). Anything that fails that check, or drifts too far in length from the current copy, is left untouched and flagged above for manual review instead of being force-applied._

---

# docs-sync run log

Local record of every docs-sync run, newest first. Not part of the Astro site build (lives under scripts/docs-sync/, outside src/content and public/) — this is for your own reference, not published.
