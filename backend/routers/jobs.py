"""
Jobs router — Jobs Feed for webui-cyber.
Reads cron job state from Hermes API server and active sessions from Hermes state.db.
"""
import json
import sqlite3
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()
HERMES_HOME = Path.home() / ".hermes"
HERMES_API = "http://127.0.0.1:8642"


def _fetch_hermes_json(endpoint: str) -> dict | None:
    try:
        req = urllib.request.Request(f"{HERMES_API}{endpoint}")
        with urllib.request.urlopen(req, timeout=8) as resp:
            return json.loads(resp.read())
    except Exception:
        return None


def _get_db(path: Path):
    if not path.exists():
        return None
    return sqlite3.connect(str(path), timeout=5)


def _active_sessions_from_db() -> list[dict]:
    """Get active (ongoing) sessions from Hermes state.db with message count."""
    db_path = HERMES_HOME / "state.db"
    conn = _get_db(db_path)
    if not conn:
        return []
    try:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("""
            SELECT
                s.id,
                s.source,
                s.model,
                s.title,
                s.started_at,
                s.ended_at,
                s.message_count,
                s.tool_call_count,
                s.input_tokens,
                s.output_tokens,
                s.estimated_cost_usd,
                s.end_reason
            FROM sessions s
            WHERE s.ended_at IS NULL
               OR s.ended_at >= (strftime('%s', 'now') - 3600)
            ORDER BY s.started_at DESC
            LIMIT 20
        """)
        rows = c.fetchall()
        conn.close()
        return [_row_to_session(r) for r in rows]
    except Exception:
        conn.close()
        return []


def _row_to_session(row: sqlite3.Row) -> dict:
    started = datetime.fromtimestamp(row["started_at"])
    now = datetime.now()
    duration_seconds = int((now - started).total_seconds())

    ended = None
    if row["ended_at"]:
        ended = datetime.fromtimestamp(row["ended_at"]).isoformat()

    return {
        "id": row["id"],
        "source": row["source"],
        "model": row["model"] or "—",
        "title": row["title"] or "—",
        "started_at": started.isoformat(),
        "ended_at": ended,
        "message_count": row["message_count"] or 0,
        "tool_call_count": row["tool_call_count"] or 0,
        "input_tokens": row["input_tokens"] or 0,
        "output_tokens": row["output_tokens"] or 0,
        "estimated_cost_usd": round(row["estimated_cost_usd"] or 0, 6),
        "end_reason": row["end_reason"],
        "duration_seconds": duration_seconds,
    }


@router.get("")
async def jobs_feed():
    """
    Jobs Feed — combines:
    - Scheduled cron jobs from Hermes API (with last result, next run)
    - Active / recently active sessions from Hermes state.db
    - Hermes system health
    """
    jobs_data = _fetch_hermes_json("/api/jobs") or {}
    hermes_status = _fetch_hermes_json("/health") or {}
    sessions = _active_sessions_from_db()

    jobs_list = jobs_data.get("jobs", [])

    # Categorize jobs by state
    scheduled = [j for j in jobs_list if j.get("state") == "scheduled"]
    paused = [j for j in jobs_list if j.get("state") == "paused"]
    error_jobs = [j for j in jobs_list if j.get("last_status") == "error"]

    # Sessions summary
    active_sessions = [s for s in sessions if s.get("ended_at") is None]
    recent_sessions = [s for s in sessions if s.get("ended_at") is not None]

    def fmt_job(j: dict) -> dict:
        return {
            "id": j["id"],
            "name": j.get("name") or j.get("id"),
            "schedule": j.get("schedule_display") or j.get("schedule", {}).get("display") if isinstance(j.get("schedule"), dict) else str(j.get("schedule", "")),
            "state": j.get("state", "unknown"),
            "enabled": j.get("enabled", True),
            "next_run_at": j.get("next_run_at"),
            "last_run_at": j.get("last_run_at"),
            "last_status": j.get("last_status"),
            "last_error": j.get("last_error"),
            "deliver": j.get("deliver"),
            "model": j.get("model"),
            "provider": j.get("provider"),
            "repeat_completed": j.get("repeat", {}).get("completed") if isinstance(j.get("repeat"), dict) else None,
            "repeat_times": j.get("repeat", {}).get("times") if isinstance(j.get("repeat"), dict) else None,
        }

    def fmt_session(s: dict) -> dict:
        return {
            "id": s["id"],
            "source": s["source"],
            "model": s["model"],
            "title": s["title"],
            "started_at": s["started_at"],
            "ended_at": s["ended_at"],
            "message_count": s["message_count"],
            "tool_call_count": s["tool_call_count"],
            "input_tokens": s["input_tokens"],
            "output_tokens": s["output_tokens"],
            "estimated_cost_usd": s["estimated_cost_usd"],
            "duration_seconds": s["duration_seconds"],
            "active": s["ended_at"] is None,
        }

    def relative_time(iso: str | None) -> str:
        if not iso:
            return "—"
        try:
            dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
            diff = datetime.now() - dt
            secs = int(diff.total_seconds())
            if secs < 60:
                return f"hace {secs}s"
            mins = secs // 60
            if mins < 60:
                return f"hace {mins}m"
            hrs = mins // 60
            if hrs < 24:
                return f"hace {hrs}h"
            return f"hace {secs // 86400}d"
        except Exception:
            return iso

    return {
        "hermes": {
            "status": hermes_status.get("status"),
            "platform": hermes_status.get("platform"),
        },
        "summary": {
            "total_jobs": len(jobs_list),
            "scheduled": len(scheduled),
            "paused": len(paused),
            "errors": len(error_jobs),
            "active_sessions": len(active_sessions),
            "recent_sessions": len(recent_sessions),
        },
        "jobs": {
            "scheduled": [fmt_job(j) for j in scheduled],
            "paused": [fmt_job(j) for j in paused],
            "errors": [fmt_job(j) for j in error_jobs],
        },
        "sessions": {
            "active": [fmt_session(s) for s in active_sessions],
            "recent": [fmt_session(s) for s in recent_sessions[:10]],
        },
        "updated_at": datetime.now().isoformat(),
    }


@router.get("/{job_id}/history")
async def job_history(job_id: str):
    """Get a specific job's full details for history view."""
    jobs_data = _fetch_hermes_json("/api/jobs") or {}
    for j in jobs_data.get("jobs", []):
        if j["id"] == job_id:
            return {
                "job": {
                    "id": j["id"],
                    "name": j.get("name"),
                    "prompt": j.get("prompt", "")[:500],
                    "schedule": j.get("schedule_display") or (
                        j.get("schedule", {}).get("display")
                        if isinstance(j.get("schedule"), dict) else str(j.get("schedule", ""))
                    ),
                    "state": j.get("state"),
                    "enabled": j.get("enabled"),
                    "next_run_at": j.get("next_run_at"),
                    "last_run_at": j.get("last_run_at"),
                    "last_status": j.get("last_status"),
                    "last_error": j.get("last_error"),
                    "deliver": j.get("deliver"),
                    "repeat_completed": j.get("repeat", {}).get("completed") if isinstance(j.get("repeat"), dict) else None,
                    "repeat_times": j.get("repeat", {}).get("times") if isinstance(j.get("repeat"), dict) else None,
                }
            }
    return {"error": "Job not found"}, 404
