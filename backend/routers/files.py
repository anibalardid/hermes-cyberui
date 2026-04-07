"""
Files router — browse, read, and edit files on the server filesystem.
Restricts access to ~/.hermes directory for safety.
"""
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
ALLOWED_ROOT = Path.home() / ".hermes"


def _safe_path(path: str) -> Path:
    """Resolve a path and ensure it's within ALLOWED_ROOT."""
    joined = (ALLOWED_ROOT / path.lstrip("/")).resolve()
    if not str(joined).startswith(str(ALLOWED_ROOT.resolve())):
        raise HTTPException(403, "Access denied: path outside allowed directory")
    return joined


class WriteFileRequest(BaseModel):
    content: str


@router.get("/browse")
async def browse(path: str = ""):
    """List directory contents or file info at a given path."""
    try:
        target = _safe_path(path)
    except HTTPException:
        return {"path": path, "entries": [], "error": "Forbidden"}

    if not target.exists():
        return {"path": path, "entries": [], "error": "Path does not exist"}

    entries = []
    if target.is_dir():
        try:
            for name in sorted(target.iterdir()):
                try:
                    stat = name.stat()
                    entries.append({
                        "name": name.name,
                        "type": "dir" if name.is_dir() else "file",
                        "size": stat.st_size,
                        "modified": stat.st_mtime,
                    })
                except PermissionError:
                    pass
        except PermissionError:
            raise HTTPException(403, "Permission denied reading directory")
    else:
        return {"path": path, "entries": [], "file": {
            "name": target.name,
            "type": "file",
            "size": target.stat().st_size,
            "modified": target.stat().st_mtime,
        }}

    return {"path": path, "entries": entries}


@router.get("/read")
async def read(path: str):
    """Read file content (text only). Binary files are rejected."""
    try:
        target = _safe_path(path)
    except HTTPException:
        raise HTTPException(403, "Access denied")

    if target.is_dir():
        raise HTTPException(400, "Cannot read a directory")

    if not target.exists():
        raise HTTPException(404, "File not found")

    # Reject obvious binary files
    binary_exts = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".pdf", ".zip", ".gz", ".tar", ".woff", ".woff2"}
    if any(target.name.lower().endswith(ext) for ext in binary_exts):
        raise HTTPException(400, "Binary files are not supported for viewing")

    try:
        content = target.read_text(encoding="utf-8", errors="replace")
    except UnicodeDecodeError:
        raise HTTPException(400, "File is not a valid text file")
    except PermissionError:
        raise HTTPException(403, "Permission denied")

    return {"path": path, "content": content, "size": len(content)}


@router.put("/write")
async def write(path: str, data: WriteFileRequest):
    """Write content to a file (creates or overwrites)."""
    try:
        target = _safe_path(path)
    except HTTPException:
        raise HTTPException(403, "Access denied")

    if target.is_dir():
        raise HTTPException(400, "Cannot write to a directory")

    # Prevent overwriting critical files
    protected = {"jobs.json", "memory.json", ".env", "settings.json"}
    if target.name in protected:
        raise HTTPException(403, f"Writing to '{target.name}' is not allowed for safety")

    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(data.content, encoding="utf-8")
    except PermissionError:
        raise HTTPException(403, "Permission denied")
    except Exception as e:
        raise HTTPException(500, f"Write failed: {e}")

    return {"ok": True, "path": path, "size": len(data.content)}