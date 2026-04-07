"""
Logs router — tail and search Hermes log files.
"""
import re
from pathlib import Path

from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter()
LOGS_DIR = Path.home() / ".hermes" / "logs"

LOG_FILES = {
    "gateway": "gateway.log",
    "gateway_error": "gateway.error.log",
    "errors": "errors.log",
    "agent": "agent.log",
}


class SearchLogs(BaseModel):
    query: str | None = None
    limit: int = 100


@router.get("/{log_type}")
async def get_log(
    log_type: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=5000),
    search: str | None = None,
):
    """Get log file lines with optional search filter."""
    if log_type not in LOG_FILES:
        from fastapi import HTTPException
        raise HTTPException(404, f"Unknown log type: {log_type}. Available: {list(LOG_FILES.keys())}")

    log_path = LOGS_DIR / LOG_FILES[log_type]
    if not log_path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, f"Log file not found: {LOG_FILES[log_type]}")

    try:
        lines = log_path.read_text(errors="ignore").splitlines()
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(500, f"Cannot read log: {e}")

    # Filter
    if search:
        pattern = re.compile(search, re.IGNORECASE)
        lines = [l for l in lines if pattern.search(l)]

    total = len(lines)
    page = lines[offset : offset + limit]

    return {
        "log_type": log_type,
        "file": LOG_FILES[log_type],
        "total_lines": total,
        "offset": offset,
        "limit": limit,
        "lines": page,
    }
