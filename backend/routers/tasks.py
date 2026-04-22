"""
Tasks router — Kanban board with history.
Data stored in ~/.hermes/tasks.json
Integrates with Hermes cron scheduler for task execution.
"""
import json
import logging
import os
import sys
import uuid
import time as time_module
import threading
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
EXEC_TIMEOUT_SECS = 1800  # 30 minutes — max polling timeout per task execution

# Inactivity timeout is dynamic based on task priority.
# Tasks that are known to be short (Low) fail faster; long tasks (High/Critical) wait longer.
def _get_inactivity_timeout(priority: str | None) -> int:
    """Return max seconds without heartbeat before failing a task.

    Tiers:
    - Critical: 20 min (1200s) — longest-running analysis, multi-agent pipelines
    - High:     15 min (900s) — research, coding, deep investigation
    - Medium:   10 min (600s) — standard tasks (DEFAULT)
    - Low:       5 min (300s) — quick tasks, less tolerance
    """
    return {
        "critical": 1200,
        "high":     900,
        "medium":   600,
        "low":      300,
    }.get((priority or "").lower(), 600)

# Kept for backward compatibility with any hard-coded references
EXEC_INACTIVITY_SECS = _get_inactivity_timeout("medium")

# Real (non-profile) Hermes home for cron operations.
# The gateway ticker reads from the real ~/.hermes, not the profile sandbox.
# When the CyberUI backend runs inside an agent profile, HERMES_HOME points
# to the profile dir, but we need cron jobs in the real home so the
# gateway ticker can find and execute them.
def _real_hermes_home() -> Path:
    """Return the real ~/.hermes path (stripping any profile suffix)."""
    hermes_home = os.environ.get("HERMES_HOME", "")
    if hermes_home:
        home_path = Path(hermes_home)
        # If HERMES_HOME is a profile path (e.g. ~/.hermes/profiles/name),
        # strip the profiles/name part to get the real home
        if str(home_path).endswith("profiles") or "/profiles/" in str(home_path):
            # e.g. /Users/anibal/.hermes/profiles/hermes-glm51-dev -> /Users/anibal/.hermes
            parts = home_path.parts
            if "profiles" in parts:
                idx = parts.index("profiles")
                return Path(*parts[:idx])
    return Path.home() / ".hermes"

def _import_cron_module(module_name: str):
    """Import a cron module with HERMES_HOME set to the real home path.
    
    Temporarily overrides HERMES_HOME so that cron operations (create_job,
    trigger_job, get_job) target the real ~/.hermes/cron/jobs.json
    instead of the profile sandbox, ensuring the gateway ticker can find them.
    """
    real_home = _real_hermes_home()
    # Save and override HERMES_HOME
    old_hermes_home = os.environ.get("HERMES_HOME")
    os.environ["HERMES_HOME"] = str(real_home)
    
    # Force reload: remove cached module if present
    modules_to_remove = [k for k in sys.modules if k.startswith("cron") or k.startswith("hermes_constants")]
    for mod in modules_to_remove:
        del sys.modules[mod]
    
    syspath_save = sys.path.copy()
    try:
        sys.path.insert(0, str(real_home / "hermes-agent"))
        module = __import__(module_name, fromlist=["*"])
    finally:
        sys.path[:] = syspath_save
        # Restore HERMES_HOME
        if old_hermes_home is not None:
            os.environ["HERMES_HOME"] = old_hermes_home
        elif "HERMES_HOME" in os.environ:
            del os.environ["HERMES_HOME"]
    return module

# Path constants — use _real_hermes_home() to ensure paths resolve
# to the real ~/.hermes even when running inside a profile sandbox
TASKS_FILE = _real_hermes_home() / "tasks.json"
CRON_OUTPUT_DIR = _real_hermes_home() / "cron" / "output"

# Global lock to protect _load/_save from race conditions (concurrent threads/polls)
_data_lock = threading.Lock()


# ── Models ────────────────────────────────────────────────────────────────────

class HistoryEntry(BaseModel):
    timestamp: str
    action: str  # created | moved | updated | executed | archived | note_added
    from_status: str | None = None
    to_status: str | None = None
    note: str | None = None
    details: dict | None = None


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    priority: str | None = "medium"  # low | medium | high | critical
    tags: list[str] | None = None
    profile: str | None = "default"
    due_date: str | None = None  # YYYY-MM-DD


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    tags: list[str] | None = None
    profile: str | None = None
    due_date: str | None = None


class TaskStatusMove(BaseModel):
    status: str  # backlog | todo | in_progress | done


class HistoryNote(BaseModel):
    note: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load() -> dict:
    """Load task data. Must be called while holding _data_lock if subsequent _save is expected."""
    if not TASKS_FILE.exists():
        return {"tasks": [], "archived": []}
    return json.loads(TASKS_FILE.read_text())


def _save(data: dict):
    """Save task data. Must be called while holding _data_lock."""
    TASKS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))


from contextlib import contextmanager

@contextmanager
def _data_transaction():
    """Acquire the data lock for a load-modify-save transaction.
    Usage:
        with _data_transaction():
            data = _load()
            # ... modify data ...
            _save(data)
    """
    with _data_lock:
        yield


def _load_safe() -> dict:
    """Thread-safe read: load data under lock to avoid partial reads."""
    with _data_lock:
        return _load()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_history(action: str, from_status: str | None = None,
                  to_status: str | None = None, note: str | None = None,
                  details: dict | None = None) -> dict:
    return HistoryEntry(
        timestamp=_now(),
        action=action,
        from_status=from_status,
        to_status=to_status,
        note=note,
        details=details,
    ).model_dump(exclude_none=True)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_tasks():
    """List all non-archived tasks."""
    data = _load_safe()
    return {"tasks": data.get("tasks", []), "updated_at": data.get("updated_at")}


# ── Gateway Status (MUST be before /{task_id} to avoid path capture) ────────

@router.get("/gateway/status")
async def gateway_status():
    """
    Check if the Hermes gateway cron ticker is alive.
    Returns: {"ticker_alive": bool, "last_tick_age_secs": int|null, "gateway_pid": int|null}
    
    Ticker is considered alive if:
      - Gateway process is running (PID found) AND
      - At least one cron job has run in the last 24 hours
    
    If the process is not running (no PID), ticker is considered dead regardless.
    """
    import subprocess

    result_data = {"ticker_alive": False, "last_tick_age_secs": None, "gateway_pid": None}
    log = logging.getLogger("tasks.gateway")

    # 1. Check if gateway process is running
    gateway_running = False
    try:
        pid_out = subprocess.run(
            ["pgrep", "-f", "hermes_cli.main gateway run"],
            capture_output=True, text=True, timeout=5,
        )
        if pid_out.stdout.strip():
            result_data["gateway_pid"] = int(pid_out.stdout.strip().split("\n")[0])
            gateway_running = True
            log.info("Gateway PID found: %s", result_data["gateway_pid"])
    except Exception as e:
        log.warning("Failed to check gateway PID: %s", e)

    # If no gateway process is running, ticker is definitely dead
    if not gateway_running:
        result_data["ticker_alive"] = False
        log.warning("No gateway process found — ticker is dead")
        return result_data

    # 2. Read jobs.json directly to check cron activity
    try:
        jobs_path = _real_hermes_home() / "cron" / "jobs.json"
        log.info("Reading jobs from: %s", jobs_path)
        with open(jobs_path, "r") as f:
            jobs_data = json.load(f)

        # Handle both formats: list of jobs or {"jobs": [...], ...}
        if isinstance(jobs_data, dict):
            jobs_list = jobs_data.get("jobs", [])
        else:
            jobs_list = jobs_data

        log.info("Loaded %d jobs", len(jobs_list))
        now = datetime.now(timezone.utc)

        # Find the most recent last_run_at across all jobs
        most_recent_run = None
        for job in jobs_list:
            last_run = job.get("last_run_at")
            if last_run:
                try:
                    # Python 3.11+ fromisoformat supports timezone offsets with colon
                    run_dt = datetime.fromisoformat(last_run)
                    # Convert to UTC for comparison
                    if run_dt.tzinfo is not None:
                        run_dt = run_dt.astimezone(timezone.utc)
                    else:
                        run_dt = run_dt.replace(tzinfo=timezone.utc)
                    if most_recent_run is None or run_dt > most_recent_run:
                        most_recent_run = run_dt
                except (ValueError, TypeError) as e:
                    log.warning("Failed to parse last_run_at=%s: %s", last_run, e)

        if most_recent_run:
            age_secs = int((now - most_recent_run).total_seconds())
            result_data["last_tick_age_secs"] = age_secs
            # Ticker is alive if gateway process exists AND any job ran within 24 hours
            # (Jobs can have intervals of hours, so 5min threshold was too aggressive)
            result_data["ticker_alive"] = age_secs < 86400  # 24 hours
            log.info("Most recent job run: %s (age=%ds, alive=%s)", most_recent_run, age_secs, result_data["ticker_alive"])
        else:
            # No jobs have ever run — could be fresh install, assume alive since process exists
            result_data["ticker_alive"] = True
            log.info("No last_run_at found, but gateway process exists — assuming alive (fresh install?)")

    except Exception as e:
        # If we can't load jobs but process is running, assume alive
        result_data["ticker_alive"] = True  # Process exists, probably alive
        result_data["error"] = str(e)
        log.error("Failed to load jobs: %s (but gateway process running, assuming alive)", e)

    return result_data


@router.post("")
async def create_task(task: TaskCreate):
    """Create a new task."""
    with _data_transaction():
        data = _load()
        now = _now()
        new_task = {
            "id": str(uuid.uuid4()),
            "title": task.title,
            "description": task.description or "",
            "status": "backlog",
            "priority": task.priority or "medium",
            "tags": task.tags or [],
            "profile": task.profile or "default",
            "due_date": task.due_date,
            "created_at": now,
            "updated_at": now,
            "history": [_make_history("created", to_status="backlog")],
        }
        data.setdefault("tasks", []).insert(0, new_task)
        data["updated_at"] = now
        _save(data)
    return new_task


@router.get("/{task_id}")
async def get_task(task_id: str):
    """Get a single task with full history."""
    data = _load_safe()
    for t in data.get("tasks", []):
        if t["id"] == task_id:
            return t
    for t in data.get("archived", []):
        if t["id"] == task_id:
            return t
    raise HTTPException(404, "Task not found")


@router.put("/{task_id}")
async def update_task(task_id: str, update: TaskUpdate):
    """Update task fields (not status)."""
    with _data_transaction():
        data = _load()
        task = None
        for t in data.get("tasks", []):
            if t["id"] == task_id:
                task = t
                break
        if not task:
            raise HTTPException(404, "Task not found")

        changes = {}
        if update.title is not None:
            changes["title"] = {"from": task["title"], "to": update.title}
            task["title"] = update.title
        if update.description is not None:
            changes["description"] = {"from": task.get("description", ""), "to": update.description}
            task["description"] = update.description
        if update.priority is not None:
            changes["priority"] = {"from": task["priority"], "to": update.priority}
            task["priority"] = update.priority
        if update.tags is not None:
            changes["tags"] = {"from": task.get("tags", []), "to": update.tags}
            task["tags"] = update.tags
        if update.profile is not None:
            changes["profile"] = {"from": task["profile"], "to": update.profile}
            task["profile"] = update.profile
        if update.due_date is not None:
            changes["due_date"] = {"from": task.get("due_date"), "to": update.due_date}
            task["due_date"] = update.due_date

        task["updated_at"] = _now()
        task["history"].append(_make_history("updated", details=changes if changes else None))
        data["updated_at"] = _now()
        _save(data)
    return task


@router.patch("/{task_id}/status")
async def move_task(task_id: str, move: TaskStatusMove):
    """Move task to a different status column."""
    valid = {"backlog", "todo", "in_progress", "done", "failed"}
    if move.status not in valid:
        raise HTTPException(400, f"Invalid status. Must be one of: {valid}")

    with _data_transaction():
        data = _load()
        task = None
        for t in data.get("tasks", []):
            if t["id"] == task_id:
                task = t
                break
        if not task:
            raise HTTPException(404, "Task not found")

        from_status = task["status"]
        task["status"] = move.status
        task["updated_at"] = _now()
        task["history"].append(_make_history(
            "moved",
            from_status=from_status,
            to_status=move.status,
        ))
        data["updated_at"] = _now()
        _save(data)
    return task


# ── Per-task tracking for parallel execution ────────────────────────────────
# _task_locks: task_id -> {"lock": threading.Lock, "job_id": str}
_task_locks: dict[str, dict] = {}
_task_locks_lock = threading.Lock()  # only for managing _task_locks dict itself


def _get_task_lock(task_id: str) -> threading.Lock:
    """Get or create a lock for a specific task_id (per-task locking)."""
    with _task_locks_lock:
        if task_id not in _task_locks:
            _task_locks[task_id] = {"lock": threading.Lock(), "job_id": None}
        return _task_locks[task_id]["lock"]


def _set_job_id(task_id: str, job_id: str):
    """Store the cron job id for a task (used by status endpoint after lock is released)."""
    with _task_locks_lock:
        if task_id in _task_locks:
            _task_locks[task_id]["job_id"] = job_id


def _release_task_lock(task_id: str):
    """Remove the task entry after execution completes."""
    with _task_locks_lock:
        _task_locks.pop(task_id, None)


def _clear_all_task_locks():
    """Reset all tracking state — called at startup to clear stale entries from previous runs."""
    with _task_locks_lock:
        _task_locks.clear()


def _reset_stale_in_progress_tasks():
    """
    Called at startup: find any tasks stuck in 'in_progress' and move them back.
    This handles the case where a previous server instance crashed or was killed
    while a task was executing, leaving the task orphaned in the data file.
    """
    with _data_transaction():
        data = _load()
        now = _now()
        for t in data.get("tasks", []):
            if t.get("status") == "in_progress":
                t["status"] = "backlog"
                t["updated_at"] = now
                t["history"].append({
                    "timestamp": now,
                    "action": "reset",
                    "from_status": "in_progress",
                    "to_status": "backlog",
                    "note": "Task reset at server startup (was stuck in in_progress)",
                    "details": None,
                })
        data["updated_at"] = now
        _save(data)


def _delete_cron_job(job_id: str):
    """Delete a cron job after task completion to prevent recurring execution.
    Silently ignores errors since the task outcome is already determined."""
    try:
        _cron = _import_cron_module("cron.jobs")
        _cron.remove_job(job_id)
    except Exception:
        pass  # Best-effort cleanup; task result is already decided


def _poll_job_and_update_task(task_id: str, job_id: str, timeout_secs: int = EXEC_TIMEOUT_SECS, task_priority: str | None = None):
    """
    Polling worker that runs in a background thread.
    Polls the cron job every 6s for up to `timeout_secs`, then updates the task
    as done/failed in tasks.json with proper error detail on timeout.

    Features:
    - Dynamic inactivity timeout based on task priority (default 5 min)
    - Better heartbeat: detects job state=running and resets timer
    - Smart waiting: if job is scheduled with future next_run_at, resets timer
    - Fast failure: if job stays in 'scheduled' for >SCHEDULED_STUCK_SECS without
      ever transitioning to running/executing, fail early (gateway ticker likely dead)
    - On timeout or inactivity, task status = 'failed' (not 'done').
    - Deletes cron job after completion to prevent recurring execution.

    Wrapped in a global try/except to guarantee cleanup: even if the polling
    logic crashes, the task is always moved out of in_progress and _task_locks
    is always cleaned up. Errors are logged to the backend log file.
    """
    import logging
    logger = logging.getLogger("tasks.poll")

    # Resolve per-task inactivity timeout
    inactivity_secs = _get_inactivity_timeout(task_priority)
    SCHEDULED_STUCK_SECS = 600  # If job stays "scheduled" for >10min with NO output, NO completions, and NO runs, fail fast
    logger.info(f"[poll] Started polling task={task_id} job={job_id} timeout={timeout_secs}s inactivity={inactivity_secs}s priority={task_priority}")

    try:
        start = time_module.time()
        last_activity = start  # Track last heartbeat
        last_progress_write = start  # Track when we last wrote a progress history entry
        output_text = None
        timeout_reached = False
        inactivity_reached = False
        error_detail = None
        running_detected = False
        was_scheduled = False
        scheduled_since = None  # Track when we first saw state=scheduled

        # Pre-cache imports to avoid doing them inside the hot loop
        _cron = _import_cron_module("cron.jobs")
        get_job = _cron.get_job

        PROGRESS_INTERVAL_SECS = 30  # Write progress to history every 30s

        while time_module.time() - start < timeout_secs:
            time_module.sleep(6)
            try:
                job = get_job(job_id)
                if not job:
                    # Job not found could mean it was cleaned up or never created
                    error_detail = "Cron job not found in Hermes — it may have been deleted or already completed"
                    logger.warning(f"[poll] Job {job_id} not found for task {task_id}")
                    break

                # ── Heartbeat: detect activity ────────────────────────────
                job_state = job.get("state", "")
                job_last_run = job.get("last_run_at")
                job_completed = job.get("repeat", {}).get("completed", 0)
                next_run = job.get("next_run_at")

                # Activity detected if: job has been run, or output dir has files
                job_out_dir = CRON_OUTPUT_DIR / job_id
                has_output_files = False
                if job_out_dir.exists():
                    files = sorted(job_out_dir.iterdir())
                    if files:
                        has_output_files = True
                        output_text = files[-1].read_text()
                        logger.info(f"[poll] Got output for task={task_id} job={job_id} ({len(output_text)} chars)")
                        break  # SUCCESS — exit loop with output

                # ── Improved heartbeat: more signals count as activity ──────
                now_epoch = time_module.time()
                is_active = (
                    job_state == "running"
                    or job_state == "executing"
                    or has_output_files
                    or job_completed > 0
                    or job_last_run
                    or (job_state == "scheduled" and next_run and datetime.fromisoformat(next_run) > datetime.now(timezone.utc))
                    or (job_state == "scheduled" and was_scheduled is True)  # already seen queued before
                )

                if job_state == "running":
                    running_detected = True
                    last_activity = now_epoch
                    scheduled_since = None  # No longer stuck in scheduled
                    logger.debug(f"[poll] Heartbeat RUNNING for task={task_id} job={job_id}")
                elif is_active:
                    last_activity = now_epoch
                    was_scheduled = was_scheduled or job_state == "scheduled"
                    logger.debug(f"[poll] Heartbeat for task={task_id} job={job_id} (state={job_state}, completed={job_completed})")

                # ── Fast failure: job stuck in 'scheduled' too long ─────────
                # If we've never seen the job transition to running/executing,
                # never detected any output, and the job has never completed a run,
                # it's likely the gateway ticker is dead or not picking up jobs.
                # But if the job HAS been run (completed > 0 or last_run_at set),
                # we don't consider it "stuck" — it just hasn't transitioned state yet.
                if not running_detected and job_state == "scheduled" and job_completed == 0 and not job_last_run and not has_output_files:
                    if scheduled_since is None:
                        scheduled_since = now_epoch
                    elif (now_epoch - scheduled_since) >= SCHEDULED_STUCK_SECS:
                        error_detail = f"Job stuck in 'scheduled' state for {int(now_epoch - scheduled_since)}s — no runs, no output, gateway ticker may not be executing new jobs. Try: hermes gateway restart"
                        logger.warning(f"[poll] SCHEDULED STUCK for task={task_id} job={job_id} ({int(now_epoch - scheduled_since)}s, never ran, no output)")
                        break
                else:
                    # Reset scheduled tracking if we see signs of life or non-scheduled state
                    scheduled_since = None

                # Check if job reached terminal state
                if job_state in ("done", "paused", "completed"):
                    logger.info(f"[poll] Job {job_id} state={job_state} for task {task_id}")
                    break
                # Check if job errored out (Hermes sets last_status=error, state may still be scheduled)
                if job.get("last_status") in ("error", "failed"):
                    last_error = job.get("last_error") or "Unknown cron error"
                    error_detail = f"Cron execution failed: {last_error}"
                    logger.warning(f"[poll] Job {job_id} last_status={job.get('last_status')} for task {task_id}: {last_error}")
                    break
                # Check if last_run is recent AND completed count went up (successful one-shot)
                if job_completed > 0 and job_state in ("scheduled",):
                    # Likely a one-shot job that ran once and is now waiting for next tick — it succeeded
                    # If last_status is ok (or any success), consider it done even without output files
                    if job.get("last_status") in ("ok", "success") and job_last_run:
                        logger.info(f"[poll] Job {job_id} completed successfully (last_status={job.get('last_status')}, completed={job_completed})")
                        break
                    if has_output_files:
                        break
                    # Give it a few cycles to write output before declaring failure
                    pass

                # ── Inactivity check (fail fast if ticker died) ───────────
                elapsed_inactive = time_module.time() - last_activity
                if elapsed_inactive >= inactivity_secs:
                    inactivity_reached = True
                    error_detail = f"No activity for {int(elapsed_inactive)}s — job may be stuck in queue or gateway ticker stopped. Restart with: hermes gateway restart"
                    logger.warning(f"[poll] Inactivity timeout for task={task_id} job={job_id} ({int(elapsed_inactive)}s no heartbeat)")
                    break

                # ── Progress heartbeat: write status to history every N seconds ──
                now_progress = time_module.time()
                if now_progress - last_progress_write >= PROGRESS_INTERVAL_SECS:
                    elapsed_total = int(now_progress - start)
                    state_label = job_state or "unknown"
                    status_msg = f"Still executing... ({elapsed_total}s elapsed, state={state_label})"
                    if running_detected:
                        status_msg = f"Agent is working... ({elapsed_total}s elapsed)"
                    with _data_transaction():
                        pdata = _load()
                        for pt in pdata.get("tasks", []):
                            if pt["id"] == task_id:
                                pt["history"].append({
                                    "timestamp": _now(),
                                    "action": "progress",
                                    "note": status_msg,
                                    "details": {
                                        "cron_job_id": job_id,
                                        "elapsed_secs": elapsed_total,
                                        "job_state": state_label,
                                    },
                                })
                                pt["updated_at"] = _now()
                                break
                        pdata["updated_at"] = _now()
                        _save(pdata)
                    last_progress_write = now_progress

            except Exception as e:
                error_detail = f"Polling error: {e}"
                logger.error(f"[poll] Error polling job {job_id} for task {task_id}: {e}")
                break
        else:
            timeout_reached = True
            error_detail = f"Execution timed out after {timeout_secs}s — check Hermes logs"
            logger.warning(f"[poll] Timeout for task={task_id} job={job_id}")

        # ── Determine final status ────────────────────────────────────────
        is_failed = bool(error_detail) or timeout_reached or inactivity_reached
        final_status = "failed" if is_failed else "done"

        # ── Update task in tasks.json ────────────────────────────────────
        with _data_transaction():
            data = _load()
            for t in data.get("tasks", []):
                if t["id"] == task_id:
                    t["updated_at"] = _now()
                    from_status = t.get("status", "in_progress")
                    t["status"] = final_status
                    history_details = {
                        "cron_job_id": job_id,
                        "output": output_text or "",
                        "output_truncated": len(output_text or "") > 2000 if output_text else False,
                    }
                    if timeout_reached:
                        history_details["timeout"] = True
                        history_details["error"] = error_detail
                    elif inactivity_reached:
                        history_details["inactivity"] = True
                        history_details["error"] = error_detail
                    elif error_detail:
                        history_details["error"] = error_detail
                    # Clean up stale progress entries — they show "Still executing..."
                    # which is misleading once the task has actually finished.
                    t["history"] = [h for h in t.get("history", []) if h.get("action") != "progress"]
                    t["history"].append({
                        "timestamp": _now(),
                        "action": "failed" if is_failed else "completed",
                        "from_status": from_status,
                        "to_status": final_status,
                        "note": None,
                        "details": history_details,
                    })
                    logger.info(f"[poll] Task {task_id} marked {final_status} (error={bool(error_detail)})")
                    break
            data["updated_at"] = _now()
            _save(data)

        # ── Delete the cron job now that the task is resolved ────────────
        # The cron job was created with schedule="* * * * *" (recurring). If we
        # don't delete it, it keeps firing every minute forever.
        _delete_cron_job(job_id)
        logger.info(f"[poll] Deleted cron job {job_id} after task {task_id} completed as {final_status}")

    except Exception as e:
        # Global catch: if anything unexpected crashes, still clean up
        logger.error(f"[poll] UNEXPECTED ERROR in poll thread for task={task_id} job={job_id}: {e}", exc_info=True)
        try:
            with _data_transaction():
                data = _load()
                for t in data.get("tasks", []):
                    if t["id"] == task_id:
                        t["status"] = "failed"
                        t["updated_at"] = _now()
                        t["history"].append({
                            "timestamp": _now(),
                            "action": "failed",
                            "from_status": "in_progress",
                            "to_status": "failed",
                            "note": f"Polling thread crashed: {e}",
                            "details": {"cron_job_id": job_id, "error": str(e), "crashed": True},
                        })
                        break
                data["updated_at"] = _now()
                _save(data)
        except Exception as save_err:
            logger.critical(f"[poll] FAILED to save error state for task={task_id}: {save_err}")
        # Also try to delete the cron job on crash — prevents recurring zombies
        _delete_cron_job(job_id)
    finally:
        # ALWAYS release the task lock, even on crash
        _release_task_lock(task_id)
        logger.info(f"[poll] Released lock for task={task_id}")


@router.post("/{task_id}/execute")
async def execute_task(task_id: str):
    """
    Execute a task via Hermes cron scheduler:
    1. Create a one-shot cron job using the task's prompt + profile
    2. Trigger it immediately (non-blocking)
    3. Return immediately with the cron_job_id; polling happens in background
    4. Task status is updated to 'done' when the background worker finishes

    Per-task lock only held during job creation (prevents same-task concurrent create).
    Different tasks execute in parallel without blocking each other.
    """
    with _data_transaction():
        data = _load()
        task = None
        for t in data.get("tasks", []):
            if t["id"] == task_id:
                task = t
                break
        if not task:
            raise HTTPException(404, "Task not found")

        if task["status"] == "done":
            raise HTTPException(400, "Task already completed")

    # Allow re-execution of failed tasks (they get moved to in_progress)

    # Use _task_locks as source of truth for in-progress (avoids TOCTOU races)
    with _task_locks_lock:
        if task_id in _task_locks:
            entry = _task_locks[task_id]
            if entry["lock"].locked() or entry["job_id"] is not None:
                raise HTTPException(409, "Task is already executing")

    task_lock = _get_task_lock(task_id)
    job_id = None

    # Acquire per-task lock for job creation ONLY
    with task_lock:
        with _data_transaction():
            data2 = _load()
            for t in data2.get("tasks", []):
                if t["id"] == task_id:
                    task = t
                    break
        prompt = task.get("description", "") or task["title"]
        job_name = f"[task] {task['title'][:60]}"
        profile = task.get("profile", "default")
        priority = task.get("priority", "medium")
        origin = {"profile": profile} if profile and profile != "default" else {}

        _cron = _import_cron_module("cron.jobs")
        create_job = _cron.create_job

        cron_job = create_job(
            prompt=prompt,
            schedule="* * * * *",
            name=job_name,
            deliver="local",
            origin=origin,
        )
        job_id = cron_job["id"]

    # Lock released here — other tasks can now create their jobs in parallel.
    # Set job_id in _task_locks so status endpoint can see it while executing.
    _set_job_id(task_id, job_id)

    # Trigger immediately (outside lock)
    try:
        _cron = _import_cron_module("cron.jobs")
        trigger_job = _cron.trigger_job
        trigger_job(job_id)
    except Exception as e:
        _release_task_lock(task_id)
        raise HTTPException(500, f"Failed to trigger job: {e}")

    # Move task to in_progress and save
    with _data_transaction():
        data3 = _load()
        for t in data3.get("tasks", []):
            if t["id"] == task_id:
                from_status = t["status"]
                t["status"] = "in_progress"
                t["updated_at"] = _now()
                t["history"].append({
                    "timestamp": _now(),
                    "action": "moved",
                    "from_status": from_status,
                    "to_status": "in_progress",
                    "details": {"cron_job_id": job_id, "trigger": "manual"},
                })
                # Enriched log entry: cron job dispatched and awaiting execution
                t["history"].append({
                    "timestamp": _now(),
                    "action": "dispatched",
                    "note": f"Cron job {job_id} created and triggered. Waiting for gateway ticker to execute...",
                    "details": {"cron_job_id": job_id, "trigger": "manual", "priority": priority},
                })
                break
        data3["updated_at"] = _now()
        _save(data3)

    # Spawn background polling thread — runs independently after this returns
    priority = task.get("priority", "medium")
    thread = threading.Thread(target=_poll_job_and_update_task, args=(task_id, job_id), kwargs={"task_priority": priority}, daemon=True)
    thread.start()

    return {"ok": True, "cron_job_id": job_id, "message": "Execution started in background"}


@router.get("/{task_id}/execute/status")
async def execute_task_status(task_id: str):
    """Check if a task is currently being executed (polling in background)."""
    with _task_locks_lock:
        entry = _task_locks.get(task_id)
    # If entry exists with job_id, it's currently executing
    if entry and entry["job_id"]:
        return {"executing": True, "cron_job_id": entry["job_id"], "task_id": task_id}
    # Check task status from data file
    data = _load_safe()
    for t in data.get("tasks", []):
        if t["id"] == task_id:
            return {"executing": False, "status": t.get("status"), "done": t.get("status") == "done"}
    return {"executing": False, "status": "unknown"}


@router.get("/{task_id}/execute/log")
async def execute_task_log(task_id: str):
    """Get the latest cron output for a task that is currently executing or recently completed.
    Returns the raw text output from the cron job's output directory.
    This endpoint powers the real-time progress view in the frontend.
    """
    # Find the task and its cron_job_id from history
    data = _load_safe()
    task = None
    for t in data.get("tasks", []):
        if t["id"] == task_id:
            task = t
            break
    if not task:
        raise HTTPException(404, "Task not found")

    # Find the most recent cron_job_id from history
    cron_job_id = None
    for h in reversed(task.get("history", [])):
        details = h.get("details") or {}
        if details.get("cron_job_id"):
            cron_job_id = details["cron_job_id"]
            break

    if not cron_job_id:
        return {"task_id": task_id, "running": task.get("status") == "in_progress", "log": None, "output": None}

    # Read cron output
    output_text = None
    job_out_dir = CRON_OUTPUT_DIR / cron_job_id
    if job_out_dir.exists():
        files = sorted(job_out_dir.iterdir())
        if files:
            try:
                raw = files[-1].read_text()
                # Truncate very large outputs for API response
                output_text = raw[:8000] if len(raw) > 8000 else raw
            except Exception:
                pass

    return {
        "task_id": task_id,
        "running": task.get("status") == "in_progress",
        "cron_job_id": cron_job_id,
        "log": output_text,
        "output": output_text,
        "status": task.get("status"),
    }


@router.post("/check-due")
async def check_due_tasks():
    """
    Hermes cron calls this every minute to auto-execute tasks
    whose due_date has passed and are not done.

    Uses the same async polling pipeline as manual /execute:
    - Marks task as in_progress immediately
    - Spawns a background polling thread
    - Does NOT block the _data_lock or sleep synchronously
    """
    now_utc = datetime.now(timezone.utc)
    to_execute = []
    with _data_transaction():
        data = _load()
        for task in data.get("tasks", []):
            if task["status"] in ("done", "in_progress") or not task.get("due_date"):
                continue
            # Skip tasks already being tracked as executing
            with _task_locks_lock:
                if task["id"] in _task_locks:
                    continue

            try:
                due = datetime.fromisoformat(task["due_date"])
                # If due_date is now or in the past (within 2-minute window)
                if (now_utc - due).total_seconds() <= 120:
                    # Mark as in_progress and record dispatch
                    from_status = task["status"]
                    task["status"] = "in_progress"
                    task["updated_at"] = _now()
                    task["history"].append({
                        "timestamp": _now(),
                        "action": "moved",
                        "from_status": from_status,
                        "to_status": "in_progress",
                        "details": {"trigger": "due_date"},
                    })
                    to_execute.append({
                        "id": task["id"],
                        "title": task["title"],
                        "description": task.get("description", ""),
                        "profile": task.get("profile", "default"),
                        "priority": task.get("priority", "medium"),
                    })
            except Exception:
                pass  # Skip malformed tasks

        if to_execute:
            data["updated_at"] = _now()
            _save(data)

    # Execute matched tasks outside the data lock
    executed = []
    for task_info in to_execute:
        try:
            prompt = task_info["description"] or task_info["title"]
            job_name = f"[task] {task_info['title'][:60]}"
            profile = task_info["profile"]
            priority = task_info["priority"]
            origin = {"profile": profile} if profile and profile != "default" else {}

            _cron = _import_cron_module("cron.jobs")
            cron_job = _cron.create_job(
                prompt=prompt,
                schedule="* * * * *",
                name=job_name,
                deliver="local",
                origin=origin,
            )
            job_id = cron_job["id"]
            _cron.trigger_job(job_id)

            # Set up per-task lock tracking for the polling thread
            _set_job_id(task_info["id"], job_id)

            # Add dispatched history entry
            with _data_transaction():
                d = _load()
                for t in d.get("tasks", []):
                    if t["id"] == task_info["id"]:
                        t["history"].append({
                            "timestamp": _now(),
                            "action": "dispatched",
                            "note": f"Cron job {job_id} auto-triggered (due_date). Waiting for gateway ticker...",
                            "details": {"cron_job_id": job_id, "trigger": "due_date", "priority": priority},
                        })
                        t["updated_at"] = _now()
                        break
                d["updated_at"] = _now()
                _save(d)

            # Spawn background polling thread (same as manual /execute)
            thread = threading.Thread(
                target=_poll_job_and_update_task,
                args=(task_info["id"], job_id),
                kwargs={"task_priority": priority},
                daemon=True,
            )
            thread.start()
            executed.append(task_info["id"])
        except Exception as e:
            # Mark as failed if dispatch fails
            with _data_transaction():
                d = _load()
                for t in d.get("tasks", []):
                    if t["id"] == task_info["id"]:
                        orig_status = t.get("status", "in_progress")
                        t["status"] = "failed"
                        t["updated_at"] = _now()
                        t["history"].append({
                            "timestamp": _now(),
                            "action": "failed",
                            "from_status": orig_status,
                            "to_status": "failed",
                            "note": f"Auto-execute dispatch failed: {e}",
                            "details": {"trigger": "due_date", "error": str(e)},
                        })
                        break
                d["updated_at"] = _now()
                _save(d)
            _release_task_lock(task_info["id"])

    return {"executed": executed}


@router.post("/{task_id}/archive")
async def archive_task(task_id: str):
    """Archive a task (move to archived list)."""
    with _data_transaction():
        data = _load()
        tasks = data.get("tasks", [])
        task = None
        for i, t in enumerate(tasks):
            if t["id"] == task_id:
                task = t
                tasks.pop(i)
                break
        if not task:
            raise HTTPException(404, "Task not found")

        task["updated_at"] = _now()
        task["history"].append(_make_history("archived"))
        data.setdefault("archived", []).insert(0, task)
        data["updated_at"] = _now()
        _save(data)
    return task


@router.post("/{task_id}/archive-all-done")
async def archive_all_done():
    """Archive all tasks with status=done or status=failed."""
    with _data_transaction():
        data = _load()
        tasks = data.get("tasks", [])
        archivable = [t for t in tasks if t.get("status") in ("done", "failed")]
        remaining = [t for t in tasks if t.get("status") not in ("done", "failed")]
        now = _now()
        for t in archivable:
            t["updated_at"] = now
            t["history"].append(_make_history("archived"))
        data["tasks"] = remaining
        data["archived"] = archivable + data.get("archived", [])
        data["updated_at"] = now
        _save(data)
    return {"archived_count": len(archivable)}


@router.delete("/{task_id}")
async def delete_task(task_id: str):
    """Permanently delete a task."""
    with _data_transaction():
        data = _load()
        tasks = data.get("tasks", [])
        for i, t in enumerate(tasks):
            if t["id"] == task_id:
                tasks.pop(i)
                data["updated_at"] = _now()
                _save(data)
                return {"ok": True}
        archived = data.get("archived", [])
        for i, t in enumerate(archived):
            if t["id"] == task_id:
                archived.pop(i)
                data["updated_at"] = _now()
                _save(data)
                return {"ok": True}
    raise HTTPException(404, "Task not found")


@router.get("/{task_id}/history")
async def get_task_history(task_id: str):
    """Get history entries for a task."""
    task = await get_task(task_id)
    return {"history": task.get("history", [])}


@router.post("/{task_id}/history")
async def add_history_note(task_id: str, note: HistoryNote):
    """Add a note to the task history."""
    with _data_transaction():
        data = _load()
        for t in data.get("tasks", []):
            if t["id"] == task_id:
                t["updated_at"] = _now()
                t["history"].append(_make_history("note_added", note=note.note))
                data["updated_at"] = _now()
                _save(data)
                return {"history": t["history"]}
    raise HTTPException(404, "Task not found")


@router.get("/archived/list")
async def list_archived():
    """List archived tasks."""
    data = _load_safe()
    return {"archived": data.get("archived", [])}


@router.post("/purge-all-archived")
async def purge_all_archived():
    """Permanently delete all archived tasks."""
    with _data_transaction():
        data = _load()
        count = len(data.get("archived", []))
        data["archived"] = []
        data["updated_at"] = _now()
        _save(data)
    return {"ok": True, "deleted_count": count}


@router.post("/{task_id}/restore")
async def restore_task(task_id: str):
    """Restore an archived task to backlog."""
    with _data_transaction():
        data = _load()
        archived = data.get("archived", [])
        task = None
        for i, t in enumerate(archived):
            if t["id"] == task_id:
                task = t
                archived.pop(i)
                break
        if not task:
            raise HTTPException(404, "Archived task not found")

        task["status"] = "backlog"
        task["updated_at"] = _now()
        task["history"].append(_make_history("restored", from_status="archived", to_status="backlog"))
        data["tasks"].insert(0, task)
        data["updated_at"] = _now()
        _save(data)
    return task
