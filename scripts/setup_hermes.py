#!/usr/bin/env python3
"""
setup_hermes.py — Idempotent setup script for webui-cyber.

Run this after deployment to configure Hermes with tasks-related resources.
Safe to run multiple times — all operations are additive/idempotent.

What it does:
  1. Create the check-tasks-due cron job (auto-executes overdue tasks)
  2. Verify profiles are accessible
  3. Ensure tasks.json is initialized
  4. Report system health
"""
import sys
import json
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

HERMES_HOME = Path.home() / ".hermes"
BACKEND = "http://localhost:23689"


def log(msg):
    print(f"[setup] {msg}")


def http_post(url, body=None):
    data = json.dumps(body or {}).encode() if body else None
    req = urllib.request.Request(url, data=data, method="POST",
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def check_backend():
    """Verify backend is running."""
    try:
        req = urllib.request.Request(f"{BACKEND}/api/tasks", method="GET")
        with urllib.request.urlopen(req, timeout=10) as r:
            json.loads(r.read())
        log("Backend: OK")
        return True
    except Exception as e:
        log(f"Backend: UNAVAILABLE ({e})")
        return False


def check_tasks_json():
    """Ensure tasks.json exists."""
    f = HERMES_HOME / "tasks.json"
    if f.exists():
        data = json.loads(f.read_text())
        tasks = data.get("tasks", [])
        archived = data.get("archived", [])
        log(f"tasks.json: OK ({len(tasks)} tasks, {len(archived)} archived)")
        return True
    else:
        f.write_text(json.dumps({"tasks": [], "archived": [], "updated_at": datetime.now(timezone.utc).isoformat()}, indent=2))
        log("tasks.json: created")
        return True


def check_hermes_cron():
    """Check if Hermes cron system is accessible."""
    try:
        sys.path.insert(0, str(HERMES_HOME / "hermes-agent"))
        from cron.jobs import load_jobs, create_job

        jobs = load_jobs()
        log(f"Hermes cron: OK ({len(jobs)} jobs loaded)")
        return True
    except Exception as e:
        log(f"Hermes cron: FAIL ({e})")
        return False


def setup_check_tasks_due():
    """Create or verify the check-tasks-due auto-scheduler cron job."""
    try:
        sys.path.insert(0, str(HERMES_HOME / "hermes-agent"))
        from cron.jobs import load_jobs, create_job, get_job, save_jobs

        jobs = load_jobs()

        # Check if check-tasks-due job already exists
        existing = next((j for j in jobs if j.get("name") == "check-tasks-due"), None)
        if existing:
            log(f"check-tasks-due cron: already exists (id={existing['id']})")
            return

        # Create the job — it calls the backend endpoint which handles execution
        # Use script to bypass LLM — run the check script directly every minute
        check_script = str(HERMES_HOME / "cron" / "check_tasks_due.py")
        job = create_job(
            prompt="Task scheduler: should never run via LLM",
            schedule="* * * * *",
            name="check-tasks-due",
            deliver="local",
            script=check_script,
        )
        log(f"check-tasks-due cron: created (id={job['id']})")
    except Exception as e:
        log(f"check-tasks-due cron: FAILED ({e})")


def check_profiles():
    """Verify profiles endpoint works."""
    try:
        resp = http_post(f"{BACKEND}/api/profiles", {})
        profiles = resp.get("profiles", [])
        log(f"Profiles: {len(profiles)} available — {', '.join(p['name'] for p in profiles)}")
    except Exception as e:
        log(f"Profiles: FAIL ({e})")


def main():
    print("=" * 50)
    print("webui-cyber setup_hermes.py")
    print("=" * 50)

    ok = check_backend()
    if not ok:
        log("Backend not reachable — start it first with: bash start.sh")
        sys.exit(1)

    check_tasks_json()
    check_profiles()
    cron_ok = check_hermes_cron()
    if cron_ok:
        setup_check_tasks_due()

    print("=" * 50)
    print("Setup complete.")
    print("=" * 50)


if __name__ == "__main__":
    main()