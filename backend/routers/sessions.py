"""
Sessions router — fully standalone, supports both JSON and JSONL session formats.
List, view, create, update, delete, and stream chat sessions.
"""
import asyncio
import json
import re
import uuid
import httpx
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()
SESSION_DIR = Path.home() / ".hermes" / "sessions"
API_SERVER_URL = "http://127.0.0.1:8642"


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
    """Load messages for a session from SessionDB (preferred) or JSONL file."""
    # Normalize: strip "session_" prefix if present
    normalized_id = session_id[8:] if session_id.startswith("session_") else session_id

    # Try SessionDB first (most complete, has timestamps)
    db_messages = _load_session_from_db(normalized_id)
    if db_messages:
        return db_messages

    # Fall back to JSONL format — try both with and without session_ prefix
    # (some files were created with the prefix in the filename)
    for candidate in (f"{normalized_id}.jsonl", f"session_{normalized_id}.jsonl"):
        jsonl_path = SESSION_DIR / candidate
        if jsonl_path.exists():
            messages = []
            for line in jsonl_path.read_text().splitlines():
                line = line.strip()
                if line:
                    try:
                        messages.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
            if messages:
                return messages

    # Fall back to JSON format — try both with and without session_ prefix
    for candidate in (f"{normalized_id}.json", f"session_{normalized_id}.json"):
        json_path = SESSION_DIR / candidate
        if json_path.exists():
            try:
                data = json.loads(json_path.read_text())
                return data.get("messages", [])
            except (json.JSONDecodeError, OSError):
                pass

    raise FileNotFoundError(f"Session {session_id} not found")


def _load_session_from_db(session_id: str) -> list[dict] | None:
    """Load messages from SessionDB if available."""
    try:
        import sys
        hermes_agent_path = Path.home() / ".hermes" / "hermes-agent"
        if not hermes_agent_path.exists():
            return None
        sys.path.insert(0, str(hermes_agent_path))
        from hermes_state import SessionDB
        db = SessionDB()
        messages = db.get_messages_as_conversation(session_id)
        return messages if messages else None
    except Exception:
        return None


def _list_sessions_from_db() -> list[dict]:
    """List sessions from SessionDB."""
    try:
        import sys
        hermes_agent_path = Path.home() / ".hermes" / "hermes-agent"
        if not hermes_agent_path.exists():
            return []
        sys.path.insert(0, str(hermes_agent_path))
        from hermes_state import SessionDB
        db = SessionDB()
        conn = db._conn
        cur = conn.execute(
            "SELECT id, source, model, message_count, title, started_at FROM sessions ORDER BY started_at DESC"
        )
        sessions = []
        for row in cur.fetchall():
            sid, source, model, msg_count, title, started_at = row
            # Skip cron/one-off sessions
            if sid.startswith("session_cron_"):
                continue
            # Format timestamp
            try:
                updated_dt = datetime.fromtimestamp(started_at)
                updated = updated_dt.isoformat()
            except (ValueError, OSError):
                updated = datetime.now().isoformat()
            # Derive title from messages if DB title is missing
            if not title:
                try:
                    msgs = db.get_messages_as_conversation(sid)
                    title = _session_title_from_messages(msgs) if msgs else None
                except Exception:
                    title = None
            sessions.append({
                "id": sid,
                "title": title or f"Session {sid[:12]}",
                "created": updated,
                "updated": updated,
                "message_count": msg_count or 0,
                "model": model,
                "platform": source,
                "source": "db",
            })
        return sessions
    except Exception:
        return []


# ── List sessions (both sources, merged, sorted by mtime) ────────────────────

def _list_sessions() -> list[dict]:
    SESSION_DIR.mkdir(parents=True, exist_ok=True)

    # Collect IDs already covered by DB (to avoid duplicating from JSONL)
    db_sessions = _list_sessions_from_db()
    db_ids = {s["id"] for s in db_sessions}

    # Build a map of session_id -> session dict for fast lookup
    sessions_map: dict[str, dict] = {s["id"]: s for s in db_sessions}

    # Add JSONL sessions that don't overlap with DB
    for sf in SESSION_DIR.iterdir():
        if not sf.is_file():
            continue
        name = sf.name
        if name.startswith("request_dump_"):
            continue
        # Determine session ID (strip "session_" prefix if present)
        if name.startswith("session_") and name.endswith(".json"):
            sid = sf.stem  # e.g. "session_20260407_205252_58e3c3"
        elif name.endswith(".jsonl"):
            sid = sf.stem
        else:
            continue

        # Normalize: strip "session_" prefix so it matches DB IDs
        normalized_sid = sid[8:] if sid.startswith("session_") else sid

        # Skip if already in DB
        if normalized_sid in db_ids:
            continue

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

        if name.endswith(".json"):
            try:
                data = json.loads(sf.read_text())
                messages = data.get("messages", [])
                model = data.get("model")
                platform = data.get("platform")
                message_count = data.get("message_count", len(messages))
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
        sessions_map[normalized_sid] = {
            "id": normalized_sid,
            "title": title or f"Session {sid[:12]}",
            "created": created.isoformat(),
            "updated": updated.isoformat(),
            "message_count": message_count,
            "model": model,
            "platform": platform,
            "source": "jsonl",
        }

    # Sort all sessions by updated desc
    result = list(sessions_map.values())
    result.sort(key=lambda s: s.get("updated", ""), reverse=True)
    return result


def _save_message(session_id: str, msg: dict):
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    sf = SESSION_DIR / f"{session_id}.jsonl"
    sf.open("a").write(json.dumps(msg, ensure_ascii=False) + "\n")


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
    Send a message in a session and stream the response via the Hermes API server.
    Transforms OpenAI SSE format to the frontend's expected {token: ...} format.
    """
    # Validate session exists
    found = False
    for ext in (".jsonl", ".json"):
        if (SESSION_DIR / f"{session_id}{ext}").exists():
            found = True
            break
    if not found:
        raise HTTPException(404, "Session not found")

    # Load conversation history for this session
    conversation_messages = _load_session_messages(session_id)

    # Build the messages array for the API server (system + history + new user message)
    messages = []
    for msg in conversation_messages:
        role = msg.get("role")
        if role in ("user", "assistant"):
            content = msg.get("content", "")
            if content:
                messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": body.message})

    # Build the API server payload
    payload = {
        "model": body.model or "hermes-agent",
        "messages": messages,
        "stream": True,
    }

    async def event_generator():
        # Save user message to session file
        _save_message(session_id, {"role": "user", "content": body.message})

        accumulated_response = ""

        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
            headers = {"Content-Type": "application/json"}
            # Pass session ID so API server maintains conversation context
            headers["X-Hermes-Session-Id"] = session_id

            try:
                async with client.stream(
                    "POST",
                    f"{API_SERVER_URL}/v1/chat/completions",
                    json=payload,
                    headers=headers,
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        yield f"data: {json.dumps({'error': f'HTTP {response.status_code}: {error_text.decode()}'})}\n\n"
                        yield f"data: {json.dumps({'done': True})}\n\n"
                        return

                    # Read the SSE stream and transform to frontend format
                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            # Save assistant response to session file
                            if accumulated_response:
                                _save_message(session_id, {"role": "assistant", "content": accumulated_response})
                            yield f"data: {json.dumps({'done': True})}\n\n"
                            return

                        try:
                            data = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue

                        # OpenAI SSE: choices[0].delta.content
                        choices = data.get("choices", [])
                        if choices:
                            delta = choices[0].get("delta", {})
                            content = delta.get("content")
                            if content:
                                accumulated_response += content
                                yield f"data: {json.dumps({'token': content})}\n\n"

                        # Handle errors in the stream
                        if data.get("error"):
                            yield f"data: {json.dumps({'error': data['error']})}\n\n"
            except httpx.TimeoutException:
                yield f"data: {json.dumps({'error': 'Request timed out after 300 seconds'})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"
            except httpx.HTTPError as e:
                yield f"data: {json.dumps({'error': f'HTTP error: {e}'})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
