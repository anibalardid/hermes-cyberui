"""
Crons router — list, pause/resume, trigger cron jobs.
Reads from ~/.hermes/cron/jobs.json
For triggering runs, calls the Hermes API server at 127.0.0.1:8642.
"""
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import urllib.request

router = APIRouter()
CRON_JOBS_FILE = Path.home() / ".hermes" / "cron" / "jobs.json"
HERMES_API = "http://127.0.0.1:8642"


class UpdateCronJob(BaseModel):
    name: str | None = None
    schedule: str | None = None
    enabled: bool | None = None
    deliver: str | None = None


def _load_jobs() -> dict:
    if not CRON_JOBS_FILE.exists():
        return {"jobs": []}
    return json.loads(CRON_JOBS_FILE.read_text())


def _save_jobs(data: dict):
    CRON_JOBS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))


@router.get("")
async def list_crons():
    """List all cron jobs."""
    data = _load_jobs()
    jobs = []
    for j in data.get("jobs", []):
        jobs.append({
            "id": j["id"],
            "name": j["name"],
            "schedule": j.get("schedule", {}).get("display") if isinstance(j.get("schedule"), dict) else j.get("schedule_display"),
            "repeat": j.get("repeat"),
            "enabled": j.get("enabled", True),
            "state": j.get("state", "unknown"),
            "next_run_at": j.get("next_run_at"),
            "last_run_at": j.get("last_run_at"),
            "last_status": j.get("last_status"),
            "last_error": j.get("last_error"),
            "deliver": j.get("deliver"),
            "model": j.get("model"),
            "provider": j.get("provider"),
        })
    return {"jobs": jobs, "updated_at": data.get("updated_at")}


@router.get("/{job_id}")
async def get_cron(job_id: str):
    """Get full cron job details including prompt."""
    cron_data = _load_jobs()
    for j in cron_data.get("jobs", []):
        if j["id"] == job_id:
            return {
                "id": j["id"],
                "name": j["name"],
                "schedule": j.get("schedule", {}).get("display") if isinstance(j.get("schedule"), dict) else j.get("schedule_display"),
                "repeat": j.get("repeat"),
                "enabled": j.get("enabled", True),
                "state": j.get("state", "unknown"),
                "next_run_at": j.get("next_run_at"),
                "last_run_at": j.get("last_run_at"),
                "last_status": j.get("last_status"),
                "last_error": j.get("last_error"),
                "deliver": j.get("deliver"),
                "model": j.get("model"),
                "provider": j.get("provider"),
                "prompt": j.get("prompt", ""),
                "script": j.get("script"),
            }
    raise HTTPException(404, "Cron job not found")


@router.put("/{job_id}")
async def update_cron(job_id: str, data: UpdateCronJob):
    """Update a cron job (name, schedule, enabled, deliver)."""
    cron_data = _load_jobs()
    job = None
    for j in cron_data.get("jobs", []):
        if j["id"] == job_id:
            job = j
            break
    if not job:
        raise HTTPException(404, "Cron job not found")

    if data.name is not None:
        job["name"] = data.name
    if data.schedule is not None:
        if isinstance(job.get("schedule"), dict):
            job["schedule"]["expr"] = data.schedule
            job["schedule"]["display"] = data.schedule
        else:
            job["schedule"] = {"kind": "cron", "expr": data.schedule, "display": data.schedule}
    if data.enabled is not None:
        job["enabled"] = data.enabled
        if data.enabled:
            job["state"] = "scheduled"
            job["paused_reason"] = None
        else:
            job["state"] = "paused"
    if data.deliver is not None:
        job["deliver"] = data.deliver

    _save_jobs(cron_data)
    return {"ok": True}


@router.post("/{job_id}/run")
async def run_cron_now(job_id: str):
    """Trigger a cron job via the Hermes API server (runs on next scheduler tick, ~60s)."""
    # Verify job exists first
    cron_data = _load_jobs()
    job = None
    for j in cron_data.get("jobs", []):
        if j["id"] == job_id:
            job = j
            break
    if not job:
        raise HTTPException(404, "Cron job not found")

    # Trigger via Hermes API server
    try:
        hermes_req = urllib.request.Request(
            f"{HERMES_API}/api/jobs/{job_id}/run",
            method="POST",
        )
        hermes_resp = urllib.request.urlopen(hermes_req, timeout=5)
        response = json.loads(hermes_resp.read())
        return {"ok": True, "message": response.get("message", "Job triggered")}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise HTTPException(e.code, f"Hermes API error: {body}")
    except Exception as e:
        raise HTTPException(502, f"Could not reach Hermes API: {e}")
