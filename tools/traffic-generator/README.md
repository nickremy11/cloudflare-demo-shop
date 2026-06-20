# Client-Side Security demo — Selenium traffic generator

Headless browser traffic for `/client-side-security/checkout`. curl-based
generators don't work for Client-Side Security inventory building because
Page Shield monitoring relies on browser CSP reporting, which only fires
from a real browser executing the page.

## What it does

A small Python script that drives Chrome (or Firefox) through Selenium:

1. `GET /client-side-security/checkout?pageshieldforcecsp` (force-sampling on).
2. Wait for the form to render so deferred scripts run and beacons fire.
3. Submit the fake checkout form so the first-party POST happens and
   `Set-Cookie` lands.
4. Sleep, jitter, repeat.

It runs as N parallel workers and can either drive a local Chrome install
or talk to a remote Selenium Grid (recommended on a headless Ubuntu VM via
the official `selenium/standalone-chrome` image).

## Layout

```
tools/traffic-generator/
├── Dockerfile             # Python + Selenium client (no browser inside)
├── docker-compose.yml     # Pairs the client with selenium/standalone-chrome
├── generate_traffic.py    # The actual generator
├── requirements.txt
└── README.md              # this file
```

## Recommended deployment (Ubuntu VM, Docker, no desktop)

```bash
git clone <this repo> /opt/cssgen
cd /opt/cssgen/tools/traffic-generator

# 1. Tell it where to hit. Use whichever hostname is proxied by Cloudflare
#    and has Client-Side Security enabled.
export TARGET_URL=https://remydemo.com/client-side-security/checkout

# 2. (Optional) tune. Defaults below match what's in docker-compose.yml:
#      1 worker, 60s interval, +/- 15s jitter
#      headed Chrome under Xvfb (HEADLESS=0)
#      fresh browser session per visit (RECYCLE_EACH_VISIT=1)
#      form submit ON, force-sampling ON
#    These defaults are tuned for Client-Side Security inventory seeding.
# export WORKERS=1
# export INTERVAL_S=60
# export JITTER_S=15
# export HEADLESS=0
# export RECYCLE_EACH_VISIT=1

# 3. Start. selenium/standalone-chrome will run alongside the generator.
docker compose up --build -d

# 4. Watch it work.
docker compose logs -f traffic
```

Each successful iteration logs `Visit N OK ...` and per-minute heartbeats
log the running attempts / success / error breakdown.

To stop:

```bash
docker compose down
```

## Without Docker (single VM, system Python)

If you'd rather not run Docker at all:

```bash
sudo apt-get update
sudo apt-get install -y python3-venv chromium-browser chromium-chromedriver

python3 -m venv /opt/cssgen-venv
source /opt/cssgen-venv/bin/activate
pip install -r requirements.txt

export TARGET_URL=https://remydemo.com/client-side-security/checkout
python3 generate_traffic.py
```

The script uses Selenium 4's built-in driver manager when `SELENIUM_URL`
is unset, so a locally-installed Chrome + chromedriver will be picked up
automatically.

## Configuration knobs

| Env var              | CLI flag           | Default | What it does                                            |
| -------------------- | ------------------ | ------- | ------------------------------------------------------- |
| `TARGET_URL`         | `--url`            | (req.)  | Full URL of the checkout page                           |
| `FORCE_CSP`          | `--no-force-csp`   | `1`     | Append `?pageshieldforcecsp` to every visit             |
| `WORKERS`            | `--workers`        | `1`     | Parallel browser sessions                               |
| `INTERVAL_S`         | `--interval`       | `60`    | Mean seconds between visits per worker                  |
| `JITTER_S`           | `--jitter`         | `15`    | +/- random jitter around the interval                   |
| `MAX_VISITS`         | `--max-visits`     | `0`     | Stop after N visits total; `0` = run forever            |
| `BROWSER`            | `--browser`        | chrome  | `chrome` or `firefox`                                   |
| `HEADLESS`           | `--no-headless`    | `1`     | Headless mode. Compose overrides this to `0` so the runner uses Xvfb (better bot score) |
| `SUBMIT_FORM`        | `--no-submit`      | `1`     | Fill + submit the fake checkout form each visit         |
| `PAGE_DWELL_S`       | `--dwell`          | `4`     | Seconds to wait on the page before submit / exit        |
| `RECYCLE_EACH_VISIT` | `--no-recycle`     | `1`     | Tear down + recreate the browser session each visit     |
| `SELENIUM_URL`       | `--selenium-url`   | (none)  | Remote Selenium Grid endpoint                           |
| `LOG_LEVEL`          |                    | `INFO`  | Python logging level                                    |

## Sizing guidance

Start small. The point is steady, browser-quality page views, not load.

- **Seeding inventory (default):** 1 worker, 60s interval, fresh browser
  session each visit, headed under Xvfb. About 60 visits / hour with each
  visit guaranteed to reload all monitored scripts from the network.
  Resources should move from `infrequent` to `active` (≥ 4 reports) within
  ~5 minutes once the first reports land.
- **Steady state (after seeding):** set `RECYCLE_EACH_VISIT=0` and
  `INTERVAL_S=120` to reduce overhead. The persistent browser session is
  fine for keeping resources in `active` status and triggering scenarios.
- **If a single worker isn't enough:** raise `WORKERS` cautiously. Each
  worker holds an independent Selenium session and (with recycle on) starts
  a Chrome process per visit. Don't go above ~4 on a small VM without also
  raising `shm_size` on the selenium service.

## Demo flow

1. **Seed**
   ```bash
   docker compose up --build -d
   ```
   Wait ~30 minutes. Confirm in the dashboard that
   `Web assets → Client-side resources` shows checkout-core.js,
   checkout-analytics.js, jquery, and the first-party cookies.

2. **Build a content security rule**
   Scope: `http.host eq "<your-host>" and http.request.uri.path eq "/client-side-security/checkout"`.
   Start in **Log** action. `script-src` and `connect-src` get suggestions
   from the monitored inventory; fill the rest by hand.

3. **Trigger an alert scenario**
   On `/client-side-security`, use the scenario toggles to enable
   `new_script`, `bad_conn`, `bad_cookie`, or `code_change`. The traffic
   generator's next visit will surface the signal.

4. **Validate**
   Watch the rule violations and the relevant alert (New Resource,
   New Domain, Malicious URL, Code Change, etc.).

5. **Reset**
   Click `Reset everything to baseline` on the solution page.

## Troubleshooting

- **`Web assets` still blank after an hour.** Verify in DevTools that
  `content-security-policy-report-only` is present on the **HTML response**
  for `/client-side-security/checkout`. If it's missing, monitoring isn't
  sampling that response. If the header is present, check the runner logs
  for `BLOCKED by Cloudflare` outcomes — that means WAF / bot is rejecting
  the runner. Verify the VM's egress IP isn't blocked.
- **Scripts/connections show up but stay `infrequent` forever.** Each
  unique script/connection needs more than three reports before it moves to
  `active`. This is why `RECYCLE_EACH_VISIT=1` is the default — Chrome's
  in-memory script cache otherwise serves the same script URL without
  hitting the network or firing a fresh CSP report. If you set
  `RECYCLE_EACH_VISIT=0`, you'll see this behavior come back.
- **`Visit N OK` runs forever but no resources appear.** Suspect bot score.
  Inspect the `_cfbm` cookie on the response from the VM:
  `curl -sI <TARGET_URL> | grep -i 'set-cookie: _cfbm='`
  A leading `1` (very low score) means Cloudflare Bot Management is
  scoring the runner as a bot, and Page Shield will discard the traffic.
  Headed Chrome under Xvfb (the default in this compose) scores
  meaningfully better than `--headless=new` on most zones.
- **Submit step hangs.** Set `SUBMIT_FORM=0` to confirm whether the form
  submission is the problem vs. the page itself.
- **Driver crashes constantly.** Bump `shm_size` on the Selenium service
  in `docker-compose.yml` to `4gb` and retry.
- **You want to test from your laptop first.** Drop `SELENIUM_URL` and let
  Selenium Manager spin up your local Chrome:
  `python3 generate_traffic.py --url https://… --workers 1 --interval 10`.
