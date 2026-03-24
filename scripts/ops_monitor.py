#!/usr/bin/env python3
import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SITE_REPO = Path(os.environ.get("JCIT_SITE_REPO", "/Users/mymacyou/Documents/itservices"))
STATUS_JSON_PATH = SITE_REPO / "assets" / "ops-status.json"
STATE_PATH = SITE_REPO / ".ops-monitor-state.json"
FORMSPREE_ENDPOINT = os.environ.get("JCIT_FORMSPREE_ENDPOINT", "https://formspree.io/f/xreabold")
ALERT_EMAIL = os.environ.get("JCIT_MONITOR_EMAIL", "ops@jcit.digital")
PUBLIC_SITE_URL = os.environ.get("JCIT_STATUS_PAGE_URL", "https://jcit.digital/status/")
AUTO_GIT_PUSH = os.environ.get("JCIT_MONITOR_GIT_PUSH", "false").lower() == "true"
GIT_BRANCH = os.environ.get("JCIT_MONITOR_GIT_BRANCH", "main")

DEFAULT_CHECKS = [
    {
        "id": "poppers_storefront",
        "label": "PoppersGuy Storefront",
        "type": "http_text",
        "target": "https://poppers.jcit.digital/poppers",
        "expect_text": "PoppersGuyPH Catalog",
        "timeout": 20,
    },
    {
        "id": "poppers_catalog_api",
        "label": "PoppersGuy Catalog API",
        "type": "http_json",
        "target": "https://poppers.jcit.digital/api/storefront/poppers-checkout",
        "method": "POST",
        "json_body": {"action": "get_catalog"},
        "expect_json": {"ok": True},
        "timeout": 20,
    },
    {
        "id": "poppers_bot",
        "label": "PoppersGuy Telegram Bot",
        "type": "telegram_getme",
        "token_env": "POPPERS_BOT_TOKEN",
    },
    {
        "id": "delu_storefront",
        "label": "deluLubes Storefront",
        "type": "http_text",
        "target": "https://delu.jcit.digital/delu",
        "expect_text": "deluLubes",
        "timeout": 20,
    },
    {
        "id": "delu_bot",
        "label": "deluLubes Telegram Bot",
        "type": "telegram_getme",
        "token_env": "DELU_BOT_TOKEN",
    },
    {
        "id": "euphoria_storefront",
        "label": "EuphoriaX Storefront",
        "type": "http_text",
        "target": "https://eux-weld.vercel.app/euphoria",
        "expect_text": "EuphoriaX",
        "timeout": 20,
    },
    {
        "id": "euphoria_bot",
        "label": "EuphoriaX Telegram Bot",
        "type": "telegram_getme",
        "token_env": "EUPHORIA_BOT_TOKEN",
    },
]




def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_state():
    if not STATE_PATH.exists():
        return {}
    try:
        return json.loads(STATE_PATH.read_text())
    except Exception:
        return {}


def write_state(data):
    STATE_PATH.write_text(json.dumps(data, indent=2))


def fetch(url, method="GET", body=None, timeout=20, headers=None):
    request = urllib.request.Request(url, method=method)
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    payload = None
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        request.add_header("Content-Type", "application/json")
    started = time.time()
    with urllib.request.urlopen(request, data=payload, timeout=timeout) as response:
        content = response.read().decode("utf-8", errors="replace")
        elapsed = int((time.time() - started) * 1000)
        return response.status, content, elapsed


def run_http_text(check):
    status, content, elapsed = fetch(check["target"], timeout=check.get("timeout", 20))
    expected = str(check.get("expect_text", "")).strip()
    if status != 200:
        raise RuntimeError(f"HTTP {status}")
    if expected and expected not in content:
        raise RuntimeError(f"Expected text not found: {expected}")
    return elapsed


def run_http_json(check):
    status, content, elapsed = fetch(
        check["target"],
        method=check.get("method", "POST"),
        body=check.get("json_body"),
        timeout=check.get("timeout", 20),
    )
    if status != 200:
        raise RuntimeError(f"HTTP {status}")
    payload = json.loads(content)
    for key, expected_value in check.get("expect_json", {}).items():
        if payload.get(key) != expected_value:
            raise RuntimeError(f"Unexpected JSON field {key}: {payload.get(key)!r}")
    return elapsed


def run_telegram_getme(check):
    token = os.environ.get(check.get("token_env", ""), "").strip()
    if not token:
        raise RuntimeError(f"Missing bot token env: {check.get('token_env')}")
    status, content, elapsed = fetch(f"https://api.telegram.org/bot{token}/getMe", timeout=20)
    if status != 200:
        raise RuntimeError(f"HTTP {status}")
    payload = json.loads(content)
    if not payload.get("ok"):
        raise RuntimeError(payload.get("description") or "Telegram getMe failed")
    return elapsed


def run_check(check):
    if check["type"] == "http_text":
        return run_http_text(check)
    if check["type"] == "http_json":
        return run_http_json(check)
    if check["type"] == "telegram_getme":
        return run_telegram_getme(check)
    raise RuntimeError(f"Unsupported check type: {check['type']}")


def submit_formspree_report(subject, service, severity, message):
    body = urllib.parse.urlencode(
        {
            "name": "JC Ops Monitor",
            "email": ALERT_EMAIL,
            "service": service,
            "severity": severity,
            "report_type": "Automated Fault Report",
            "message": message,
            "_subject": subject,
        }
    ).encode("utf-8")
    request = urllib.request.Request(FORMSPREE_ENDPOINT, data=body, method="POST")
    request.add_header("Content-Type", "application/x-www-form-urlencoded")
    request.add_header("Accept", "application/json")
    with urllib.request.urlopen(request, timeout=20) as response:
        response.read()


def maybe_publish_status():
    if not AUTO_GIT_PUSH:
        return
    subprocess.run(["git", "-C", str(SITE_REPO), "add", "assets/ops-status.json", ".ops-monitor-state.json"], check=True)
    subprocess.run(["git", "-C", str(SITE_REPO), "commit", "-m", "Update operations status board"], check=False)
    subprocess.run(["git", "-C", str(SITE_REPO), "push", "origin", GIT_BRANCH], check=True)


def main():
    previous_state = read_state()
    current_state = {}
    results = []

    for check in DEFAULT_CHECKS:
        checked_at = now_iso()
        prev = previous_state.get(check["id"], {})
        try:
            elapsed = run_check(check)
            status = "up"
            last_error = ""
            consecutive_failures = 0
        except Exception as exc:
            elapsed = 0
            status = "down"
            last_error = str(exc)
            consecutive_failures = int(prev.get("consecutive_failures", 0)) + 1

        result = {
            "id": check["id"],
            "label": check["label"],
            "type": check["type"],
            "target": check["target"] if "target" in check else check.get("token_env", "telegram"),
            "status": status,
            "checked_at": checked_at,
            "response_ms": elapsed,
            "last_error": last_error,
            "consecutive_failures": consecutive_failures,
        }
        results.append(result)
        current_state[check["id"]] = result

        previous_status = prev.get("status")
        if previous_status and previous_status != status:
            if status == "down":
                message = (
                    f"Automated outage detected\n\n"
                    f"Service: {check['label']}\n"
                    f"Target: {result['target']}\n"
                    f"Checked At: {checked_at}\n"
                    f"Error: {last_error}\n\n"
                    f"Status board: {PUBLIC_SITE_URL}"
                )
                submit_formspree_report(
                    "JC IT Services - Automated Outage Detected",
                    check["label"],
                    "Critical - Down",
                    message,
                )
            elif previous_status == "down" and status == "up":
                recovery = (
                    f"Automated recovery detected\n\n"
                    f"Service: {check['label']}\n"
                    f"Target: {result['target']}\n"
                    f"Recovered At: {checked_at}\n"
                    f"Status board: {PUBLIC_SITE_URL}"
                )
                submit_formspree_report(
                    "JC IT Services - Automated Recovery",
                    check["label"],
                    "Minor - Issue resolved",
                    recovery,
                )

    summary = {
        "total_checks": len(results),
        "up": sum(1 for item in results if item["status"] == "up"),
        "down": sum(1 for item in results if item["status"] == "down"),
        "degraded": sum(1 for item in results if item["status"] == "degraded"),
        "auto_reports_enabled": True,
    }

    STATUS_JSON_PATH.write_text(
        json.dumps(
            {
                "generated_at": now_iso(),
                "interval_minutes": 10,
                "summary": summary,
                "checks": results,
            },
            indent=2,
        )
    )
    write_state(current_state)
    maybe_publish_status()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ops_monitor failed: {exc}", file=sys.stderr)
        sys.exit(1)
