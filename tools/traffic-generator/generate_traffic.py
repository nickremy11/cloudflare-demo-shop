#!/usr/bin/env python3
"""
Cloudflare Client-Side Security demo — Selenium traffic generator.

Hits /client-side-security/checkout in a headless browser on a loop so that
Cloudflare gets real, JavaScript-executing page views to sample. curl-style
generators do not work for this — Page Shield monitoring relies on browser
CSP reporting, which only fires from a real browser executing the page.

Defaults are conservative: 1 worker, ~25s interval, runs forever. Override
with env vars or CLI flags.

Environment variables:
  TARGET_URL      Full URL of the checkout page (required if --url not set).
                  Example: https://remydemo.com/client-side-security/checkout
  FORCE_CSP       "1" to append ?pageshieldforcecsp (default: 1).
  INTERVAL_S      Mean seconds between visits per worker (default: 25).
  JITTER_S        +/- seconds of random jitter around INTERVAL_S (default: 10).
  WORKERS         Parallel worker count (default: 1).
  MAX_VISITS      Stop after N visits across all workers. 0 = forever (default).
  BROWSER         "chrome" or "firefox" (default: chrome).
  HEADLESS        "1" headless, "0" headed (default: 1).
  SUBMIT_FORM     "1" to fill + submit the fake checkout form each visit
                  (default: 1). Set to 0 for pure page-view traffic.
  PAGE_DWELL_S    Seconds to wait after the page loads before submit/exit
                  (default: 4).
  LOG_LEVEL       Python logging level name (default: INFO).
  SELENIUM_URL    Remote Selenium endpoint (e.g. http://selenium:4444/wd/hub).
                  When unset, uses a local driver. Set this when running
                  inside Docker alongside selenium/standalone-chrome.

Exit codes:
  0   normal shutdown (SIGINT / MAX_VISITS reached)
  2   bad configuration
  3   fatal Selenium error
"""

from __future__ import annotations

import argparse
import logging
import os
import random
import signal
import sys
import threading
import time
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlencode, urlparse, urlunparse

try:
    from selenium import webdriver
    from selenium.common.exceptions import (
        TimeoutException,
        WebDriverException,
    )
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait
except ImportError as e:  # pragma: no cover
    print("Selenium not installed. pip install selenium", file=sys.stderr)
    raise


# ─────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────


@dataclass
class Config:
    target_url: str
    force_csp: bool
    interval_s: float
    jitter_s: float
    workers: int
    max_visits: int
    browser: str
    headless: bool
    submit_form: bool
    page_dwell_s: float
    selenium_url: Optional[str]


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    return float(raw)


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    return int(raw)


def load_config(argv: Optional[list[str]] = None) -> Config:
    p = argparse.ArgumentParser(
        description="Cloudflare Client-Side Security demo traffic generator."
    )
    p.add_argument("--url", help="Target URL (overrides TARGET_URL)")
    p.add_argument(
        "--browser",
        choices=["chrome", "firefox"],
        default=os.environ.get("BROWSER", "chrome"),
    )
    p.add_argument("--workers", type=int, default=_env_int("WORKERS", 1))
    p.add_argument(
        "--interval", type=float, default=_env_float("INTERVAL_S", 25.0)
    )
    p.add_argument(
        "--jitter", type=float, default=_env_float("JITTER_S", 10.0)
    )
    p.add_argument(
        "--max-visits", type=int, default=_env_int("MAX_VISITS", 0)
    )
    p.add_argument(
        "--no-force-csp",
        dest="force_csp",
        action="store_false",
        default=_env_bool("FORCE_CSP", True),
    )
    p.add_argument(
        "--no-headless",
        dest="headless",
        action="store_false",
        default=_env_bool("HEADLESS", True),
    )
    p.add_argument(
        "--no-submit",
        dest="submit_form",
        action="store_false",
        default=_env_bool("SUBMIT_FORM", True),
    )
    p.add_argument(
        "--dwell",
        type=float,
        default=_env_float("PAGE_DWELL_S", 4.0),
        help="Seconds to wait on the page before submit / exit",
    )
    p.add_argument(
        "--selenium-url",
        default=os.environ.get("SELENIUM_URL"),
        help="Remote Selenium endpoint (overrides local driver)",
    )
    args = p.parse_args(argv)

    target = args.url or os.environ.get("TARGET_URL")
    if not target:
        p.error("Target URL required (use --url or TARGET_URL env var).")

    return Config(
        target_url=target,
        force_csp=args.force_csp,
        interval_s=args.interval,
        jitter_s=args.jitter,
        workers=max(1, args.workers),
        max_visits=max(0, args.max_visits),
        browser=args.browser,
        headless=args.headless,
        submit_form=args.submit_form,
        page_dwell_s=max(0.0, args.dwell),
        selenium_url=args.selenium_url,
    )


# ─────────────────────────────────────────────────────────────────
# URL helpers
# ─────────────────────────────────────────────────────────────────


def with_force_csp(url: str, enabled: bool) -> str:
    """Append ?pageshieldforcecsp to the URL when enabled.

    Force-sampling is the documented way to get Page Shield monitoring
    headers attached to more responses while seeding inventory.
    """
    if not enabled:
        return url
    parsed = urlparse(url)
    existing = parsed.query
    if "pageshieldforcecsp" in existing:
        return url
    new_query = (existing + "&" if existing else "") + "pageshieldforcecsp"
    return urlunparse(parsed._replace(query=new_query))


# ─────────────────────────────────────────────────────────────────
# Driver factory
# ─────────────────────────────────────────────────────────────────


def build_driver(cfg: Config):
    if cfg.browser == "firefox":
        opts = webdriver.FirefoxOptions()
        if cfg.headless:
            opts.add_argument("-headless")
        if cfg.selenium_url:
            return webdriver.Remote(
                command_executor=cfg.selenium_url, options=opts
            )
        return webdriver.Firefox(options=opts)

    # Chrome / Chromium
    opts = webdriver.ChromeOptions()
    if cfg.headless:
        # The "new" headless mode in modern Chrome is the one that emits
        # CSP reports the same way a real browser does.
        opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1366,900")
    opts.add_argument(
        "--user-agent=Mozilla/5.0 (X11; Ubuntu; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 "
        "remydemo-cssgen/1.0"
    )

    if cfg.selenium_url:
        return webdriver.Remote(
            command_executor=cfg.selenium_url, options=opts
        )
    return webdriver.Chrome(options=opts)


# ─────────────────────────────────────────────────────────────────
# Visit logic
# ─────────────────────────────────────────────────────────────────


def perform_visit(driver, cfg: Config, logger: logging.Logger) -> None:
    url = with_force_csp(cfg.target_url, cfg.force_csp)
    logger.debug("GET %s", url)
    driver.get(url)

    # Wait for the page shell, including the bootstrap inline script that
    # fetches scenarios. We use the order summary as a stable anchor.
    try:
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.ID, "checkout-form"))
        )
    except TimeoutException:
        logger.warning("Timed out waiting for #checkout-form on %s", url)

    # Dwell so deferred scripts execute, beacons fire, scenarios apply.
    time.sleep(cfg.page_dwell_s)

    if cfg.submit_form:
        try:
            # The form values are pre-filled by the page. Just click submit.
            submit = driver.find_element(
                By.CSS_SELECTOR, "#checkout-form button[type=submit]"
            )
            submit.click()
            # Wait briefly for the status text to update so the submit POST
            # actually leaves the browser.
            try:
                WebDriverWait(driver, 8).until(
                    lambda d: d.find_element(
                        By.ID, "checkout-status"
                    ).text.strip()
                    != ""
                )
            except TimeoutException:
                logger.debug("Checkout status did not update; continuing.")
        except WebDriverException as e:
            logger.warning("Submit failed: %s", e)

    # Final small dwell so analytics/telemetry beacons aren't cut off when
    # the navigation away happens.
    time.sleep(min(2.0, cfg.page_dwell_s))


# ─────────────────────────────────────────────────────────────────
# Worker loop
# ─────────────────────────────────────────────────────────────────


def _sleep_with_jitter(interval_s: float, jitter_s: float, stop: threading.Event):
    delay = max(0.0, interval_s + random.uniform(-jitter_s, jitter_s))
    # Wake quickly on shutdown.
    stop.wait(delay)


def worker_loop(
    worker_id: int,
    cfg: Config,
    counter: dict,
    counter_lock: threading.Lock,
    stop: threading.Event,
):
    logger = logging.getLogger(f"worker.{worker_id}")
    driver = None
    backoff = 5.0

    while not stop.is_set():
        if driver is None:
            try:
                logger.info("Starting browser session")
                driver = build_driver(cfg)
                backoff = 5.0
            except Exception as e:
                logger.error("Failed to start browser: %s", e)
                _sleep_with_jitter(backoff, 0.0, stop)
                backoff = min(60.0, backoff * 1.5)
                continue

        try:
            perform_visit(driver, cfg, logger)
            with counter_lock:
                counter["visits"] += 1
                visits = counter["visits"]
            logger.info("Visit %d complete", visits)
            if cfg.max_visits and visits >= cfg.max_visits:
                logger.info(
                    "Reached MAX_VISITS=%d, signaling shutdown",
                    cfg.max_visits,
                )
                stop.set()
                break
        except WebDriverException as e:
            logger.warning("WebDriverException, recycling driver: %s", e)
            try:
                driver.quit()
            except Exception:
                pass
            driver = None
            _sleep_with_jitter(backoff, 0.0, stop)
            backoff = min(60.0, backoff * 1.5)
            continue
        except Exception as e:
            logger.exception("Unexpected error during visit: %s", e)

        _sleep_with_jitter(cfg.interval_s, cfg.jitter_s, stop)

    if driver is not None:
        try:
            driver.quit()
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────────
# Entrypoint
# ─────────────────────────────────────────────────────────────────


def main(argv: Optional[list[str]] = None) -> int:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    logger = logging.getLogger("main")

    try:
        cfg = load_config(argv)
    except SystemExit as e:
        return int(e.code) if e.code is not None else 2

    logger.info(
        "Config: target=%s workers=%d interval=%.1fs jitter=%.1fs "
        "force_csp=%s headless=%s submit=%s browser=%s selenium=%s "
        "max_visits=%d",
        cfg.target_url,
        cfg.workers,
        cfg.interval_s,
        cfg.jitter_s,
        cfg.force_csp,
        cfg.headless,
        cfg.submit_form,
        cfg.browser,
        cfg.selenium_url or "(local)",
        cfg.max_visits,
    )

    stop = threading.Event()

    def _handle_signal(signum, _frame):
        logger.info("Received signal %d, shutting down", signum)
        stop.set()

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    counter = {"visits": 0}
    counter_lock = threading.Lock()
    threads = []
    for i in range(cfg.workers):
        t = threading.Thread(
            target=worker_loop,
            name=f"worker-{i}",
            args=(i, cfg, counter, counter_lock, stop),
            daemon=True,
        )
        t.start()
        threads.append(t)

    try:
        while not stop.is_set() and any(t.is_alive() for t in threads):
            stop.wait(1.0)
    except KeyboardInterrupt:
        stop.set()

    logger.info("Waiting for workers to drain...")
    for t in threads:
        t.join(timeout=30)

    logger.info("Total visits: %d", counter["visits"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
