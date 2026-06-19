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

# 2. (Optional) tune. Defaults: 2 workers, ~25s interval, +/- 10s jitter,
#    headless Chrome, form submit ON, force-sampling ON.
export WORKERS=2
export INTERVAL_S=25
export JITTER_S=10

# 3. Start. selenium/standalone-chrome will run alongside the generator.
docker compose up --build -d

# 4. Watch it work.
docker compose logs -f traffic
```

Each successful iteration logs `Visit N complete`.

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

| Env var         | CLI flag           | Default | What it does                                            |
| --------------- | ------------------ | ------- | ------------------------------------------------------- |
| `TARGET_URL`    | `--url`            | (req.)  | Full URL of the checkout page                           |
| `FORCE_CSP`     | `--no-force-csp`   | `1`     | Append `?pageshieldforcecsp` to every visit             |
| `WORKERS`       | `--workers`        | `1`     | Parallel browser sessions                               |
| `INTERVAL_S`    | `--interval`       | `25`    | Mean seconds between visits per worker                  |
| `JITTER_S`      | `--jitter`         | `10`    | +/- random jitter around the interval                   |
| `MAX_VISITS`    | `--max-visits`     | `0`     | Stop after N visits total; `0` = run forever            |
| `BROWSER`       | `--browser`        | chrome  | `chrome` or `firefox`                                   |
| `HEADLESS`      | `--no-headless`    | `1`     | Headless mode (always 1 on a server VM)                 |
| `SUBMIT_FORM`   | `--no-submit`      | `1`     | Fill + submit the fake checkout form each visit         |
| `PAGE_DWELL_S`  | `--dwell`          | `4`     | Seconds to wait on the page before submit / exit        |
| `SELENIUM_URL`  | `--selenium-url`   | (none)  | Remote Selenium Grid endpoint                           |
| `LOG_LEVEL`     |                    | `INFO`  | Python logging level                                    |

## Sizing guidance

Start small. The point is steady, browser-quality page views, not load.

- **Seeding inventory:** 2 workers, 25s interval — about 280 visits / hour.
  Plenty to populate Web Assets within an hour.
- **Steady state:** 1 worker, 60s interval is enough to keep resources in
  "active" status after the initial seed.
- **Don't go above ~10 sessions per VM** without raising `SE_NODE_MAX_SESSIONS`
  and `shm_size` on the Selenium container.

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
  sampling that response.
- **Submit step hangs.** Set `SUBMIT_FORM=0` to confirm whether the form
  submission is the problem vs. the page itself.
- **Driver crashes constantly.** Bump `shm_size` on the Selenium service
  in `docker-compose.yml` to `4gb` and retry.
- **You want to test from your laptop first.** Drop `SELENIUM_URL` and let
  Selenium Manager spin up your local Chrome:
  `python3 generate_traffic.py --url https://… --workers 1 --interval 10`.
