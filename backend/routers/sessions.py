"""
Sessions router — fully standalone, supports both JSON and JSONL session formats.
List, view, create, update, delete, and stream chat sessions.
"""
import asyncio
import json
import queue
import re
import threading
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()
SESSION_DIR = Path.home() / ".hermes" / "sessions"


# ── Models ───────────────────────────────────────────────────────────────────

class RenameRequest(BaseModel):
    title: str

class ChatRequest(BaseModel):
    message: str
    model: str | None = None


# ── Format detection ─────────────────────────────────────────────────────────

def _is_json_format(path: Path) -> bool:
    """Return True for session_*.json / session_cron_*.json files."""
    name = path.name
    return name.startswith("session_") and name.endswith(".json") and not name.startswith("request_dump_")


def _is_jsonl_format(path: Path) -> bool:
    """Return True for legacy *.jsonl files."""
    return path.suffix == ".jsonl"


# ── Title extraction ─────────────────────────────────────────────────────────

def _session_title_from_messages(messages: list[dict]) -> str:
    """Derive title from first user message."""
    for msg in messages:
        if msg.get("role") == "user":
            content = msg.get("content", "")
            if content:
                return content[:60] + ("..." if len(content) > 60 else "")
    return ""


# ── Load session messages (both formats) ─────────────────────────────────────

def _load_session_messages(session_id: str) -> list[dict]:
    """Load messages from a session file. Handles both JSON and JSONL formats."""
    # Try JSON format first
    json_path = SESSION_DIR / f"{session_id}.json"
    if json_path.exists():
        try:
            data = json.loads(json_path.read_text())
            messages = data.get("messages", [])
            if messages:
                return messages
        except (json.JSONDecodeError, OSError):
            pass

    # Fall back to JSONL format
    jsonl_path = SESSION_DIR / f"{session_id}.jsonl"
    if jsonl_path.exists():
        messages = []
        for line in jsonl_path.read_text().splitlines():
            line = line.strip()
            if line:
                try:
                    messages.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
        return messages

    raise FileNotFoundError(f"Session {session_id} not found")


# ── List sessions (both formats, merged, sorted by mtime) ────────────────────

def _list_sessions() -> list[dict]:
    SESSION_DIR.mkdir(parents=True, exist_ok=True)

    # Collect all session files (both formats, excluding request dumps)
    session_files: list[tuple[Path, str]] = []  # (path, session_id)

    for sf in SESSION_DIR.iterdir():
        if not sf.is_file():
            continue
        name = sf.name
        # Skip request dumps and non-session files
        if name.startswith("request_dump_"):
            continue
        if name.startswith("session_") and name.endswith(".json"):
            sid = sf.stem  # e.g. "session_20260407_015156_c6f38e"
            session_files.append((sf, sid))
        elif name.endswith(".jsonl"):
            sid = sf.stem
            session_files.append((sf, sid))

    sessions = []
    for sf, sid in session_files:
        try:
            # Get file timestamps
            try:
                ctime = datetime.fromtimestamp(sf.stat().st_ctime)
                mtime = datetime.fromtimestamp(sf.stat().st_mtime)
            except OSError:
                ctime = mtime = datetime.now()

            messages: list[dict] = []
            model: str | None = None
            platform: str | None = None
            message_count = 0

            if _is_json_format(sf):
                # JSON format: single JSON object
                try:
                    data = json.loads(sf.read_text())
                    messages = data.get("messages", [])
                    model = data.get("model")
                    platform = data.get("platform")
                    message_count = data.get("message_count", len(messages))
                    # Use last_updated if available, else mtime
                    last_updated_str = data.get("last_updated")
                    if last_updated_str:
                        try:
                            updated = datetime.fromisoformat(last_updated_str.replace("Z", "+00:00"))
                        except ValueError:
                            updated = mtime
                    else:
                        updated = mtime
                    created_str = data.get("session_start")
                    if created_str:
                        try:
                            created = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                        except ValueError:
                            created = ctime
                    else:
                        created = ctime
                except (json.JSONDecodeError, OSError):
                    continue
            else:
                # JSONL format: one JSON object per line
                updated = mtime
                created = ctime
                for line in sf.read_text().splitlines():
                    line = line.strip()
                    if line:
                        try:
                            msg = json.loads(line)
                            messages.append(msg)
                            if not model:
                                model = msg.get("model")
                            if not platform:
                                platform = msg.get("platform")
                        except json.JSONDecodeError:
                            pass
                message_count = len(messages)

            title = _session_title_from_messages(messages)
            sessions.append({
                "id": sid,
                "title": title or f"Session {sid[:12]}",
                "created": created.isoformat(),
                "updated": updated.isoformat(),
                "message_count": message_count,
                "model": model,
                "platform": platform,
            })
        except Exception:
            continue

    # Sort by updated desc
    sessions.sort(key=lambda s: s.get("updated", ""), reverse=True)
    return sessions


def _save_message(session_id: str, msg: dict):
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    sf = SESSION_DIR / f"{session_id}.jsonl"
    sf.open("a").write(json.dumps(msg, ensure_ascii=False) + "\n")


# ── Streaming stub ───────────────────────────────────────────────────────────

def _stub_streaming(session_id: str, message: str, callback, error_callback, done_callback):
    """Stub streaming that echoes the message."""
    try:
        import time
        words = ["Hermes", "CyberUI", "is", "running.", "Chat", "streaming", "will", "work", "once", "hermes-webui", "dependencies", "are", "available."]
        for word in words:
            callback(word + " ", {})
            time.sleep(0.1)
        done_callback()
    except Exception as e:
        error_callback(str(e))


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("")
async def list_sessions():
    """List all sessions (both JSON and JSONL formats) sorted by most recent."""
    return _list_sessions()


@router.get("/{session_id}")
async def get_session_messages(session_id: str):
    """Get all messages in a session."""
    messages = _load_session_messages(session_id)
    return {
        "id": session_id,
        "title": _session_title_from_messages(messages) or f"Session {session_id[:12]}",
        "messages": messages,
    }


@router.post("")
async def create_session():
    """Create a new empty session (JSONL format)."""
    sid = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    sf = SESSION_DIR / f"{sid}.jsonl"
    sf.write_text("")
    return {"id": sid, "title": f"Session {sid}"}


@router.put("/{session_id}")
async def rename_session(session_id: str, body: RenameRequest):
    """Rename a session title (JSONL only)."""
    sf = SESSION_DIR / f"{session_id}.jsonl"
    if not sf.exists():
        raise HTTPException(404, "Session not found")
    lines = sf.read_text().splitlines()
    if not lines:
        raise HTTPException(400, "Session is empty")
    first = json.loads(lines[0])
    first["title"] = body.title
    lines[0] = json.dumps(first)
    sf.write_text("\n".join(lines) + "\n")
    return {"ok": True, "title": body.title}


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    """Delete a session (tries both formats)."""
    for ext in (".jsonl", ".json"):
        sf = SESSION_DIR / f"{session_id}{ext}"
        if sf.exists():
            sf.unlink()
            return {"ok": True}
    raise HTTPException(404, "Session not found")


@router.post("/{session_id}/chat")
async def chat_in_session(session_id: str, body: ChatRequest):
    """
    Send a message in a session and stream the response.
    Uses hermes-webui streaming if available, falls back to stub.
    """
    # Validate session exists
    found = False
    for ext in (".jsonl", ".json"):
        if (SESSION_DIR / f"{session_id}{ext}").exists():
            found = True
            break
    if not found:
        raise HTTPException(404, "Session not found")

    # Save user message
    _save_message(session_id, {"role": "user", "content": body.message})

    # Try hermes-webui streaming
    _streaming_fn = None
    try:
        import sys
        hermes_path = Path.home() / ".hermes" / "hermes-webui"
        if hermes_path.exists():
            sys.path.insert(0, str(hermes_path))
            from api.streaming import _run_agent_streaming
            _streaming_fn = _run_agent_streaming
    except Exception:
        pass

    q: queue.Queue = queue.Queue()

    def callback(token: str, meta: dict):
        q.put(("token", token))

    def error_callback(err: str):
        q.put(("error", err))

    def done_callback():
        q.put(("done", ""))

    fn = _streaming_fn if _streaming_fn else _stub_streaming
    t = threading.Thread(
        target=fn,
        args=(session_id, body.message, callback, error_callback, done_callback),
        daemon=True,
    )
    t.start()

    async def event_generator():
        while True:
            await asyncio.sleep(0.05)
            try:
                item = q.get_nowait()
            except queue.Empty:
                continue
            if item[0] == "token":
                yield f"data: {json.dumps({'token': item[1]})}\n\n"
            elif item[0] == "error":
                yield f"data: {json.dumps({'error': item[1]})}\n\n"
                break
            elif item[0] == "done":
                yield f"data: {json.dumps({'done': True})}\n\n"
                break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
