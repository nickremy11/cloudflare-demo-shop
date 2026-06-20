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
  TARGET_URL          Full URL of the checkout page (required if --url not set).
                      Example: https://remydemo.com/client-side-security/checkout
  FORCE_CSP           "1" to append ?pageshieldforcecsp (default: 1).
  INTERVAL_S          Mean seconds between visits per worker (default: 60).
  JITTER_S            +/- seconds of random jitter around INTERVAL_S
                      (default: 15).
  WORKERS             Parallel worker count (default: 1).
  MAX_VISITS          Stop after N visits across all workers. 0 = forever
                      (default).
  BROWSER             "chrome" or "firefox" (default: chrome).
  HEADLESS            "1" headless, "0" headed (default: 1). Non-headless
                      via Xvfb on the selenium image scores better with
                      Cloudflare Bot Management.
  SUBMIT_FORM         "1" to fill + submit the fake checkout form each visit
                      (default: 1). Set to 0 for pure page-view traffic.
  PAGE_DWELL_S        Seconds to wait after the page loads before submit/exit
                      (default: 4).
  RECYCLE_EACH_VISIT  "1" to tear down + recreate the browser session on
                      every visit (default: 1). This is what makes the same
                      script URLs generate fresh CSP reports each time, which
                      is required to move resources from "infrequent" to
                      "active" in Client-Side Security. Set to 0 for steady-
                      state operation after inventory is already seeded.
  LOG_LEVEL           Python logging level name (default: INFO).
  SELENIUM_URL        Remote Selenium endpoint (e.g. http://selenium:4444/wd/hub).
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
    # If True, a fresh browser session is created for EVERY visit and torn
    # down right after. This is the right default for Page Shield / Client-
    # Side Security inventory seeding because the browser's in-memory script
    # cache + persistent profile otherwise prevents repeated CSP reports for
    # the same script URLs. Set false (RECYCLE_EACH_VISIT=0) to reuse a
    # single long-lived browser session — lower overhead, fine for steady-
    # state operation after inventory is already seeded.
    recycle_each_visit: bool


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
        "--interval", type=float, default=_env_float("INTERVAL_S", 60.0)
    )
    p.add_argument(
        "--jitter", type=float, default=_env_float("JITTER_S", 15.0)
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
    p.add_argument(
        "--no-recycle",
        dest="recycle_each_visit",
        action="store_false",
        default=_env_bool("RECYCLE_EACH_VISIT", True),
        help="Reuse a single browser session across visits (faster, but "
        "may suppress repeated CSP reports for the same script URLs).",
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
        recycle_each_visit=args.recycle_each_visit,
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


# Markers we look for in the rendered page_source to detect that we did NOT
# get the real checkout page. If any of these match, the visit is a failure
# regardless of how Chrome behaved.
_BLOCK_PAGE_MARKERS = (
    "Sorry, you have been blocked",
    "Attention Required! | Cloudflare",
    "cdn-cgi/challenge-platform",
    "cf-error-details",
    "cf-chl-bypass",
    "/cdn-cgi/access/login",
)


@dataclass
class VisitResult:
    """Outcome of a single page visit."""

    # "success" — checkout page rendered and (when enabled) submit succeeded
    # "form_missing" — page loaded but #checkout-form never appeared
    # "submit_failed" — form found but click/POST flow failed
    # "blocked" — Cloudflare block/challenge/Access interstitial was returned
    # "navigation_error" — driver.get itself threw
    status: str
    detail: str = ""
    url: str = ""
    title: str = ""


def _short_msg(e: BaseException) -> str:
    """Return the first line of a WebDriverException message, no stack."""
    msg = getattr(e, "msg", None) or str(e)
    return msg.splitlines()[0] if msg else e.__class__.__name__


def _looks_blocked(page_source: str) -> Optional[str]:
    """If the page is a Cloudflare block/challenge, return which marker matched."""
    if not page_source:
        return None
    for marker in _BLOCK_PAGE_MARKERS:
        if marker in page_source:
            return marker
    return None


def _safe_current_url(driver) -> str:
    try:
        return driver.current_url or ""
    except Exception:
        return ""


def _safe_title(driver) -> str:
    try:
        return (driver.title or "").strip()
    except Exception:
        return ""


def _safe_source(driver, limit: int = 4000) -> str:
    """Best-effort page source, truncated. Used only for diagnostics."""
    try:
        src = driver.page_source or ""
    except Exception:
        return ""
    return src[:limit]


def perform_visit(driver, cfg: Config, logger: logging.Logger) -> VisitResult:
    url = with_force_csp(cfg.target_url, cfg.force_csp)
    logger.debug("GET %s", url)

    try:
        driver.get(url)
    except WebDriverException as e:
        return VisitResult(
            status="navigation_error",
            detail=_short_msg(e),
            url=_safe_current_url(driver),
            title=_safe_title(driver),
        )

    # Wait for the page shell. The checkout form is in the initial HTML so
    # this should succeed almost immediately unless we got something else
    # back (block page, challenge, redirect, error page).
    form_present = False
    try:
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.ID, "checkout-form"))
        )
        form_present = True
    except TimeoutException:
        form_present = False

    current_url = _safe_current_url(driver)
    title = _safe_title(driver)

    if not form_present:
        # First, look for known block/challenge markers so we can give a
        # single clear log line instead of a Chrome stack trace.
        block_marker = _looks_blocked(_safe_source(driver))
        if block_marker:
            return VisitResult(
                status="blocked",
                detail=f"matched={block_marker!r}",
                url=current_url,
                title=title,
            )
        return VisitResult(
            status="form_missing",
            detail="#checkout-form not found within 20s",
            url=current_url,
            title=title,
        )

    # Dwell so deferred scripts execute, beacons fire, scenarios apply.
    time.sleep(cfg.page_dwell_s)

    if cfg.submit_form:
        try:
            submit = driver.find_element(
                By.CSS_SELECTOR, "#checkout-form button[type=submit]"
            )
            submit.click()
            try:
                WebDriverWait(driver, 8).until(
                    lambda d: d.find_element(
                        By.ID, "checkout-status"
                    ).text.strip()
                    != ""
                )
            except TimeoutException:
                logger.debug("Checkout status did not update within 8s.")
        except WebDriverException as e:
            return VisitResult(
                status="submit_failed",
                detail=_short_msg(e),
                url=_safe_current_url(driver),
                title=title,
            )

    # Final small dwell so analytics/telemetry beacons aren't cut off when
    # the navigation away happens.
    time.sleep(min(2.0, cfg.page_dwell_s))

    return VisitResult(
        status="success",
        detail="",
        url=current_url,
        title=title,
    )


# ─────────────────────────────────────────────────────────────────
# Worker loop
# ─────────────────────────────────────────────────────────────────


def _sleep_with_jitter(interval_s: float, jitter_s: float, stop: threading.Event):
    delay = max(0.0, interval_s + random.uniform(-jitter_s, jitter_s))
    # Wake quickly on shutdown.
    stop.wait(delay)


def _bump_counter(
    counter: dict, counter_lock: threading.Lock, key: str
) -> int:
    """Increment a named counter under lock, return new value."""
    with counter_lock:
        counter[key] = counter.get(key, 0) + 1
        return counter[key]


def _close_driver(driver, logger: logging.Logger) -> None:
    """Best-effort driver teardown. Never raises."""
    if driver is None:
        return
    try:
        driver.quit()
    except Exception as e:
        logger.debug("driver.quit() raised %s", _short_msg(e))


def worker_loop(
    worker_id: int,
    cfg: Config,
    counter: dict,
    counter_lock: threading.Lock,
    stop: threading.Event,
):
    """Worker loop.

    Two operating modes, selected by Config.recycle_each_visit:

    1. recycle_each_visit=True (default): each visit gets a fresh browser
       session. This is the right shape for Client-Side Security inventory
       seeding — it defeats Chrome's in-memory script cache and persistent
       profile so the same script URLs generate fresh CSP reports on every
       visit, which is what moves resources from "infrequent" to "active".
       Cost is one Chrome session create + quit per visit; we offset that
       with a larger default interval (60s + jitter).

    2. recycle_each_visit=False: a single browser session is held open and
       reused across visits. Faster, fewer Chrome processes, but the same
       cache/session effects that hide repeated script loads from Client-
       Side Security. Useful after inventory has been seeded and the runner
       is only there to keep resources in "active" status and to trigger
       scenarios.
    """
    logger = logging.getLogger(f"worker.{worker_id}")
    driver = None
    backoff = 5.0
    session_seq = 0  # for human-friendly session IDs in logs

    while not stop.is_set():
        # ── 1. Acquire a driver ──────────────────────────────────
        if driver is None:
            try:
                session_seq += 1
                session_label = f"s{session_seq}"
                logger.info("Opening browser session %s", session_label)
                driver = build_driver(cfg)
                backoff = 5.0
            except Exception as e:
                logger.error("Failed to start browser: %s", _short_msg(e))
                _sleep_with_jitter(backoff, 0.0, stop)
                backoff = min(60.0, backoff * 1.5)
                continue

        # ── 2. Perform one visit ─────────────────────────────────
        try:
            result = perform_visit(driver, cfg, logger)
        except WebDriverException as e:
            _bump_counter(counter, counter_lock, "driver_errors")
            logger.warning(
                "Driver error during visit, recycling session: %s",
                _short_msg(e),
            )
            _close_driver(driver, logger)
            driver = None
            _sleep_with_jitter(backoff, 0.0, stop)
            backoff = min(60.0, backoff * 1.5)
            continue
        except Exception as e:
            _bump_counter(counter, counter_lock, "unexpected_errors")
            logger.exception("Unexpected error during visit: %s", e)
            _sleep_with_jitter(cfg.interval_s, cfg.jitter_s, stop)
            continue

        # ── 3. Record outcome ────────────────────────────────────
        total = _bump_counter(counter, counter_lock, "attempts")
        per_status = _bump_counter(
            counter, counter_lock, f"status_{result.status}"
        )

        # Statuses that mean the browser session is in a bad state. We
        # always close in these cases regardless of the recycle setting.
        always_close = {"blocked", "form_missing", "navigation_error"}

        if result.status == "success":
            logger.info(
                "Visit %d OK (success=%d) url=%s title=%r",
                total,
                per_status,
                result.url or "(unknown)",
                result.title or "",
            )
        elif result.status == "blocked":
            logger.warning(
                "Visit %d BLOCKED by Cloudflare (count=%d) %s url=%s title=%r",
                total,
                per_status,
                result.detail,
                result.url or "(unknown)",
                result.title or "",
            )
        elif result.status == "form_missing":
            logger.warning(
                "Visit %d MISSING FORM (count=%d) %s url=%s title=%r",
                total,
                per_status,
                result.detail,
                result.url or "(unknown)",
                result.title or "",
            )
        elif result.status == "submit_failed":
            logger.warning(
                "Visit %d SUBMIT FAILED (count=%d) %s url=%s",
                total,
                per_status,
                result.detail,
                result.url or "(unknown)",
            )
        elif result.status == "navigation_error":
            logger.warning(
                "Visit %d NAVIGATION ERROR (count=%d) %s",
                total,
                per_status,
                result.detail,
            )
        else:
            logger.warning(
                "Visit %d UNKNOWN STATUS=%s (count=%d) %s",
                total,
                result.status,
                per_status,
                result.detail,
            )

        # ── 4. Decide session lifetime ───────────────────────────
        if cfg.recycle_each_visit or result.status in always_close:
            logger.info("Closing browser session after visit %d", total)
            _close_driver(driver, logger)
            driver = None

        # ── 5. Stop if MAX_VISITS hit ────────────────────────────
        if cfg.max_visits and total >= cfg.max_visits:
            logger.info(
                "Reached MAX_VISITS=%d, signaling shutdown", cfg.max_visits
            )
            stop.set()
            break

        # ── 6. Wait before next visit ────────────────────────────
        _sleep_with_jitter(cfg.interval_s, cfg.jitter_s, stop)

    _close_driver(driver, logger)


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
        "force_csp=%s headless=%s submit=%s recycle_each_visit=%s "
        "browser=%s selenium=%s max_visits=%d",
        cfg.target_url,
        cfg.workers,
        cfg.interval_s,
        cfg.jitter_s,
        cfg.force_csp,
        cfg.headless,
        cfg.submit_form,
        cfg.recycle_each_visit,
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

    counter: dict = {}
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

    def _format_summary() -> str:
        with counter_lock:
            snap = dict(counter)
        attempts = snap.get("attempts", 0)
        ok = snap.get("status_success", 0)
        parts = [f"attempts={attempts}", f"ok={ok}"]
        for key in (
            "status_blocked",
            "status_form_missing",
            "status_submit_failed",
            "status_navigation_error",
            "driver_errors",
            "unexpected_errors",
        ):
            v = snap.get(key, 0)
            if v:
                parts.append(f"{key}={v}")
        return " ".join(parts)

    try:
        last_summary = time.time()
        while not stop.is_set() and any(t.is_alive() for t in threads):
            stop.wait(1.0)
            now = time.time()
            if now - last_summary >= 60.0:
                logger.info("Heartbeat: %s", _format_summary())
                last_summary = now
    except KeyboardInterrupt:
        stop.set()

    logger.info("Waiting for workers to drain...")
    for t in threads:
        t.join(timeout=30)

    logger.info("Final summary: %s", _format_summary())
    return 0


if __name__ == "__main__":
    sys.exit(main())
