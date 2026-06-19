#!/usr/bin/env bash
# Smoke test the demo target from the VM before standing up the full
# Selenium stack. Verifies the checkout page is reachable, the supporting
# endpoints exist on the deploy, and Page Shield monitoring headers are
# present on the HTML response.
#
# Usage:
#   TARGET_BASE=https://remydemo.com ./smoke-test.sh
#
# Exits non-zero on the first failed check.

set -euo pipefail

TARGET_BASE="${TARGET_BASE:-https://remydemo.com}"
CHECKOUT_PATH="${CHECKOUT_PATH:-/client-side-security/checkout}"

red()   { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
blue()  { printf "\033[34m%s\033[0m\n" "$*"; }

fail() { red "FAIL: $*"; exit 1; }

blue "==> Target base: $TARGET_BASE"
blue "==> Checkout path: $CHECKOUT_PATH"
echo

# 1. Checkout HTML reachable + has the monitoring CSP-RO header.
blue "1. GET ${CHECKOUT_PATH}?pageshieldforcecsp"
headers="$(curl -sI "${TARGET_BASE}${CHECKOUT_PATH}?pageshieldforcecsp")" \
  || fail "couldn't reach ${TARGET_BASE}${CHECKOUT_PATH}"

if ! grep -qi "^content-security-policy-report-only:" <<<"$headers"; then
  fail "no content-security-policy-report-only header on checkout HTML"
fi

if ! grep -qi "script_monitor/report" <<<"$headers"; then
  fail "monitoring report endpoint not referenced in CSP-RO header"
fi
green "   ok — CSP-RO monitoring header present"
echo

# 2. checkout-core.js served.
blue "2. GET /api/page-shield/checkout-core.js"
core_headers="$(curl -sI "${TARGET_BASE}/api/page-shield/checkout-core.js")"
grep -qi "^x-demo-script: checkout-core" <<<"$core_headers" \
  || fail "checkout-core.js not deployed (missing X-Demo-Script header)"
green "   ok — checkout-core.js deployed"
echo

# 3. checkout-analytics.js served.
blue "3. GET /api/page-shield/checkout-analytics.js"
an_headers="$(curl -sI "${TARGET_BASE}/api/page-shield/checkout-analytics.js")"
grep -qi "^x-demo-script-version:" <<<"$an_headers" \
  || fail "checkout-analytics.js not deployed (missing X-Demo-Script-Version)"
green "   ok — checkout-analytics.js deployed ($(grep -i x-demo-script-version <<<"$an_headers" | tr -d '\r'))"
echo

# 4. Scenarios endpoint reachable + JSON.
blue "4. GET /api/page-shield/checkout/scenarios"
sc_json="$(curl -s "${TARGET_BASE}/api/page-shield/checkout/scenarios")"
echo "$sc_json" | python3 -c "import sys,json; json.loads(sys.stdin.read())" \
  >/dev/null 2>&1 \
  || fail "scenarios endpoint returned non-JSON: $sc_json"
green "   ok — scenarios endpoint returned valid JSON"
echo "   $sc_json"
echo

# 5. Submit endpoint emits two separate Set-Cookie headers.
blue "5. POST /api/page-shield/checkout/submit (expect two Set-Cookie headers)"
submit_headers="$(curl -sD - -o /dev/null -X POST \
  "${TARGET_BASE}/api/page-shield/checkout/submit" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Smoke Test","card":"4111111111111111"}')"
demo_cookies="$(grep -ci "^set-cookie: demo_checkout_" <<<"$submit_headers" || true)"
if [ "$demo_cookies" -lt 2 ]; then
  red "   only $demo_cookies demo_checkout_* Set-Cookie headers found:"
  grep -i "^set-cookie" <<<"$submit_headers" || true
  fail "submit endpoint not emitting both demo cookies"
fi
green "   ok — $demo_cookies demo_checkout_* Set-Cookie headers emitted"
echo

green "All checks passed. Ready to run: docker compose up --build -d"
