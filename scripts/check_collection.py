#!/usr/bin/env python3
"""Wake the existing API and verify its scheduled collector, without secrets."""
import argparse
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import time
import urllib.request

STATUS_URL = "https://benefit-alert.onrender.com/api/data-status"


def timestamp(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None


def evaluate(data, now, started):
    if not data.get("configured"):
        return "error", "Government API collection is not configured."
    latest = data.get("latest") or {}
    status = latest.get("status")
    if data.get("attentionReason") == "CREDENTIAL_REJECTED" or latest.get("errorCode") == "credential_rejected":
        return "error", "Government API credentials were rejected; operator configuration needs checking."
    if status == "RUNNING" or data.get("stalled") or (status == "FAILED" and latest.get("errorCode") == "interrupted"):
        return "wait", "Waiting for collection or expired lease recovery."
    failures = data.get("consecutiveFailures", 0)
    if type(failures) is int and failures >= 3:
        return "error", f"{failures} consecutive collection attempts did not complete successfully."
    finished = timestamp(latest.get("finishedAt"))
    if status in ("FAILED", "PARTIAL") and finished and finished >= started:
        return "error", "The collection attempt did not complete successfully."
    next_attempt = timestamp(data.get("nextAttemptAt"))
    if next_attempt and next_attempt <= now:
        return "wait", "Waiting for the server scheduler to start the due collection."
    if status == "SUCCESS" and data.get("freshness") == "CURRENT":
        return "healthy", "The last full snapshot is current."
    if next_attempt and next_attempt <= now + timedelta(minutes=12):
        return "wait", "Waiting for the scheduled retry."
    return "error", "No current successful snapshot or near-term retry is available."


def fetch_status():
    request = urllib.request.Request(STATUS_URL, headers={"Cache-Control": "no-cache", "User-Agent": "benefit-alert-collection-check"})
    with urllib.request.urlopen(request, timeout=90) as response:
        # Bound responses: this endpoint contains metadata, never full listings.
        data = json.loads(response.read(65537))
        if not isinstance(data, dict) or "freshness" not in data:
            raise ValueError("Unexpected collection status response")
        return data


def safe_time(value):
    try:
        parsed = timestamp(value)
        return parsed.astimezone(timezone.utc).isoformat() if parsed and parsed.tzinfo else "none"
    except (ValueError, TypeError, AttributeError):
        return "none"


def summary(ok, reason, data):
    latest = data.get("latest") or {}
    attention = data.get("attentionReason")
    if attention not in ("DISABLED", "STALLED", "CREDENTIAL_REJECTED", "REPEATED_FAILURE", "STALE", "WAITING", "NONE"):
        attention = "UNKNOWN"
    failures = data.get("consecutiveFailures", 0)
    failures = failures if type(failures) is int and failures >= 0 else "unknown"
    text = "\n".join([
        "## Collection check", "",
        f"Result: {'SUCCESS' if ok else 'FAILED'}", reason,
        f"Attention: {attention}",
        f"Consecutive incomplete attempts: {failures}",
        f"Last full success (UTC): {safe_time(data.get('lastSuccessAt'))}",
        f"Next attempt (UTC): {safe_time(data.get('nextAttemptAt'))}",
        f"Processed records in latest attempt: {latest.get('fetchedCount', 0)}", "",
    ])
    print(text, flush=True)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a") as output:
            output.write(text)


def monitor(timeout=3600, interval=20):
    started = datetime.now(timezone.utc)
    deadline = time.monotonic() + timeout
    last = {}
    reason = "No status response was available."
    unavailable = 0
    while time.monotonic() < deadline:
        try:
            last = fetch_status()
            outcome, message = evaluate(last, datetime.now(timezone.utc), started)
            reason = message
            print(f"{outcome}: {message} Processed: {(last.get('latest') or {}).get('fetchedCount', 0)}", flush=True)
            if outcome != "wait":
                summary(outcome == "healthy", message, last)
                return 0 if outcome == "healthy" else 1
        except (OSError, ValueError, TypeError, AttributeError) as error:
            unavailable += 1
            # Only log the type: connection errors can include request details.
            print(f"Status temporarily unavailable ({type(error).__name__}); retrying.", flush=True)
        remaining = deadline - time.monotonic()
        if remaining > 0:
            time.sleep(min(interval, remaining))
    summary(False, f"Timed out. {reason} Unavailable status responses: {unavailable}.", last)
    return 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout-seconds", type=int, default=3600)
    parser.add_argument("--poll-seconds", type=int, default=20)
    args = parser.parse_args()
    if not 1 <= args.timeout_seconds <= 3600 or not 1 <= args.poll_seconds <= 60:
        parser.error("timeout must be 1–3600 seconds; polling must be 1–60 seconds")
    raise SystemExit(monitor(args.timeout_seconds, args.poll_seconds))
