"""
Sessions router — fully standalone, supports both JSON and JSONL session formats.
List, view, create, update, delete, and stream chat sessions.
Supports persistent streams that survive client disconnects and page refreshes.
"""
import asyncio
import json
import re
import uuid
import httpx
import yaml
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()
SESSION_DIR = Path.home() / ".hermes" / "sessions"
API_SERVER_URL = "http://127.0.0.1:8642"


# ── Active Stream Store ───────────────────────────────────────────────────────
# Keeps stream state alive even if the frontend disconnects, enabling
# reconnection via GET /{id}/stream after page refresh.

@dataclass
class StreamState:
    """Tracks an in-progress assistant response."""
    session_id: str
    accumulated: str = ""          # Full text generated so far
    all_tokens: list[str] = field(default_factory=list)  # Every token event produced (for reconnect replay)
    done: asyncio.Event = field(default_factory=asyncio.Event)    # Set when stream finishes
    new_token: asyncio.Condition = field(default_factory=asyncio.Condition)  # Signal for new tokens
    error: Optional[str] = None     # Error message if stream failed
    saved: bool = False             # Whether response has been persisted to file
    task: Optional[asyncio.Task] = None  # Background task reference


class ActiveStreamStore:
    """Global store of active streams, keyed by session_id."""

    def __init__(self):
        self._streams: dict[str, StreamState] = {}

    def get(self, session_id: str) -> Optional[StreamState]:
        return self._streams.get(session_id)

    def create(self, session_id: str) -> StreamState:
        # If there's already an active stream, cancel it
        if session_id in self._streams:
            old = self._streams[session_id]
            if old.task and not old.task.done():
                old.task.cancel()
        state = StreamState(session_id=session_id)
        self._streams[session_id] = state
        return state

    def remove(self, session_id: str):
        self._streams.pop(session_id, None)

    def has_active(self, session_id: str) -> bool:
        state = self._streams.get(session_id)
        if state is None:
            return False
        if state.done.is_set():
            # Stream finished — clean up if we haven't already
            return not state.saved  # Still not saved = something went wrong
        return True

active_streams = ActiveStreamStore()


def _get_api_server_key() -> str:
    """Read API_SERVER_KEY from hermes config.yaml (platforms.api_server.extra.key)."""
    try:
        cfg_path = Path.home() / ".hermes" / "config.yaml"
        if not cfg_path.exists():
            return ""
        cfg = yaml.safe_load(cfg_path.read_text()) or {}
        return (cfg.get("platforms", {})
                .get("api_server", {})
                .get("extra", {})
                .get("key", ""))
    except Exception:
        return ""


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
            # Session file exists — return messages (even if empty for a new session)
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
            "SELECT id, source, model, message_count, title, started_at, parent_session_id FROM sessions ORDER BY started_at DESC"
        )
        sessions = []
        for row in cur.fetchall():
            sid, source, model, msg_count, title, started_at, parent_sid = row
            # Skip cron/one-off sessions
            if sid.startswith("session_cron_"):
                continue
            # Skip subagent sessions — they are child sessions of delegate_task
            # and appear as duplicate conversations in the UI
            if parent_sid:
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

def _get_subagent_session_ids() -> set[str]:
    """Return set of session IDs that are subagent children (have parent_session_id set)."""
    try:
        import sqlite3
        db_path = Path.home() / ".hermes" / "state.db"
        if not db_path.exists():
            return set()
        conn = sqlite3.connect(str(db_path))
        try:
            cur = conn.execute(
                "SELECT id FROM sessions WHERE parent_session_id IS NOT NULL AND parent_session_id != ''"
            )
            return {row[0] for row in cur.fetchall()}
        finally:
            conn.close()
    except Exception:
        return set()


def _list_sessions() -> list[dict]:
    SESSION_DIR.mkdir(parents=True, exist_ok=True)

    # Get IDs of subagent sessions (will be filtered from file-based listing too)
    subagent_ids = _get_subagent_session_ids()

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

        # Skip subagent sessions from file listing too
        if normalized_sid in subagent_ids:
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
    """Append a message to the session JSONL file. Skips if identical to the last message."""
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    sf = SESSION_DIR / f"{session_id}.jsonl"
    
    # Deduplication: skip if last line has same role and content
    if sf.exists():
        try:
            last_line = sf.read_text().strip().splitlines()[-1]
            last_msg = json.loads(last_line)
            if last_msg.get("role") == msg.get("role") and last_msg.get("content") == msg.get("content"):
                return
        except (json.JSONDecodeError, IndexError, OSError):
            pass  # If we can't read last line, just append
    
    sf.open("a").write(json.dumps(msg, ensure_ascii=False) + "\n")


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("")
async def list_sessions():
    """List all sessions (both JSON and JSONL formats) sorted by most recent."""
    return _list_sessions()


@router.get("/{session_id}")
async def get_session_messages(session_id: str):
    """Get all messages in a session."""
    try:
        messages = _load_session_messages(session_id)
    except FileNotFoundError:
        # Session not found in any format — return empty
        messages = []
    return {
        "id": session_id,
        "title": _session_title_from_messages(messages) or f"Session {session_id[:12]}",
        "messages": messages,
    }


@router.post("")
async def create_session():
    """Create a new empty session (JSONL format) with api_server platform."""
    sid = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    sf = SESSION_DIR / f"{sid}.jsonl"
    # Write a metadata line so the session is listed under 'api_server' platform
    metadata = {"role": "system", "content": "", "platform": "api_server", "timestamp": datetime.now().isoformat()}
    sf.write_text(json.dumps(metadata, ensure_ascii=False) + "\n")
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


def _delete_session_from_db(session_id: str) -> bool:
    """Delete a session from SessionDB (state.db). Returns True if deleted."""
    try:
        import sqlite3
        db_path = Path.home() / ".hermes" / "state.db"
        if not db_path.exists():
            return False
        conn = sqlite3.connect(str(db_path))
        try:
            cur = conn.execute("SELECT id FROM sessions WHERE id = ?", (session_id,))
            if cur.fetchone() is None:
                return False
            conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
            conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            conn.commit()
            return True
        finally:
            conn.close()
    except Exception:
        return False


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    """Delete a session from both filesystem and SessionDB."""
    deleted = False
    # Delete filesystem files — try both with and without "session_" prefix
    for prefix in ("", "session_"):
        for ext in (".jsonl", ".json"):
            sf = SESSION_DIR / f"{prefix}{session_id}{ext}"
            if sf.exists():
                sf.unlink()
                deleted = True
    # Also delete from SessionDB (sessions can exist in both)
    if _delete_session_from_db(session_id):
        deleted = True
    if deleted:
        return {"ok": True}
    raise HTTPException(404, f"Session not found: {session_id}")


@router.post("/{session_id}/chat")
async def chat_in_session(session_id: str, body: ChatRequest):
    """
    Send a message in a session and stream the response.
    The stream runs in a background task that survives client disconnects.
    Frontend can reconnect via GET /{session_id}/stream if the page is refreshed.
    """
    # Validate session exists
    found = False
    for ext in (".jsonl", ".json"):
        if (SESSION_DIR / f"{session_id}{ext}").exists():
            found = True
            break
    if not found:
        # Also check DB
        if _load_session_from_db(session_id):
            found = True
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

    # Save user message to session file
    _save_message(session_id, {"role": "user", "content": body.message})

    # Build the API server payload
    payload = {
        "model": body.model or "hermes-agent",
        "messages": messages,
        "stream": True,
    }

    # Create stream state (cancels any previous stream for this session)
    state = active_streams.create(session_id)

    async def background_stream():
        """Run the API server stream in the background, appending to all_tokens and signaling consumers."""
        accumulated = ""
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
                headers = {"Content-Type": "application/json"}
                headers["X-Hermes-Session-Id"] = session_id
                api_key = _get_api_server_key()
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"

                async with client.stream(
                    "POST",
                    f"{API_SERVER_URL}/v1/chat/completions",
                    json=payload,
                    headers=headers,
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        err = f"HTTP {response.status_code}: {error_text.decode()}"
                        state.error = err
                        state.all_tokens.append(json.dumps({"error": err}))
                        state.all_tokens.append(json.dumps({"done": True}))
                        state.done.set()
                        async with state.new_token:
                            state.new_token.notify_all()
                        return

                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            # Stream completed successfully — save full response
                            if accumulated:
                                _save_message(session_id, {"role": "assistant", "content": accumulated})
                            state.accumulated = accumulated
                            state.saved = True
                            state.all_tokens.append(json.dumps({"done": True}))
                            state.done.set()
                            async with state.new_token:
                                state.new_token.notify_all()
                            return

                        try:
                            data = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue

                        choices = data.get("choices", [])
                        if choices:
                            delta = choices[0].get("delta", {})
                            content = delta.get("content")
                            if content:
                                accumulated += content
                                state.accumulated = accumulated
                                state.all_tokens.append(json.dumps({"token": content}))
                                async with state.new_token:
                                    state.new_token.notify_all()

                        if data.get("error"):
                            state.all_tokens.append(json.dumps({"error": data["error"]}))
                            async with state.new_token:
                                state.new_token.notify_all()

        except httpx.TimeoutException:
            state.error = "Request timed out after 300 seconds"
            if accumulated and not state.saved:
                _save_message(session_id, {"role": "assistant", "content": accumulated, "truncated": True})
                state.saved = True
            state.all_tokens.append(json.dumps({"error": "Request timed out after 300 seconds"}))
            state.all_tokens.append(json.dumps({"done": True}))
            state.done.set()
            async with state.new_token:
                state.new_token.notify_all()
        except httpx.HTTPError as e:
            state.error = str(e)
            if accumulated and not state.saved:
                _save_message(session_id, {"role": "assistant", "content": accumulated, "truncated": True})
                state.saved = True
            state.all_tokens.append(json.dumps({"error": f"HTTP error: {e}"}))
            state.all_tokens.append(json.dumps({"done": True}))
            state.done.set()
            async with state.new_token:
                state.new_token.notify_all()
        except asyncio.CancelledError:
            # Stream was cancelled (e.g., new message sent in same session)
            if accumulated and not state.saved:
                _save_message(session_id, {"role": "assistant", "content": accumulated, "truncated": True})
                state.saved = True
            state.done.set()
            async with state.new_token:
                state.new_token.notify_all()
            raise
        except Exception as e:
            state.error = str(e)
            if accumulated and not state.saved:
                _save_message(session_id, {"role": "assistant", "content": accumulated, "truncated": True})
                state.saved = True
            state.all_tokens.append(json.dumps({"error": f"Stream error: {e}"}))
            state.all_tokens.append(json.dumps({"done": True}))
            state.done.set()
            async with state.new_token:
                state.new_token.notify_all()
        finally:
            # Safety net: save partial response if not already saved
            if accumulated and not state.saved:
                _save_message(session_id, {"role": "assistant", "content": accumulated, "truncated": True})
                state.saved = True
            state.done.set()
            async with state.new_token:
                state.new_token.notify_all()
            # Clean up from active store after a delay (allow consumers to drain)
            await asyncio.sleep(3)
            active_streams.remove(session_id)

    # Launch the background task
    state.task = asyncio.create_task(background_stream())

    # Return SSE stream that reads from all_tokens starting at current position
    async def event_generator():
        """Yield tokens from all_tokens list, waiting for new ones via Condition."""
        cursor = len(state.all_tokens)  # Start from current position (skip what was already generated)
        try:
            while True:
                # Yield any new tokens since our cursor
                while cursor < len(state.all_tokens):
                    data_json = state.all_tokens[cursor]
                    cursor += 1
                    yield f"data: {data_json}\n\n"
                    data = json.loads(data_json) if isinstance(data_json, str) else data_json
                    if data.get("done"):
                        return

                # If stream is done and we've yielded everything, exit
                if state.done.is_set() and cursor >= len(state.all_tokens):
                    return

                # Wait for new tokens
                async with state.new_token:
                    try:
                        await asyncio.wait_for(state.new_token.wait(), timeout=2.0)
                    except asyncio.TimeoutError:
                        pass
        except (GeneratorExit, asyncio.CancelledError):
            # Client disconnected — background task keeps running
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/{session_id}/stream")
async def reconnect_stream(session_id: str):
    """
    Reconnect to an active stream for a session.
    If a stream is in progress, replays accumulated text then continues with live tokens.
    If no stream is active, returns immediately with status info.
    """
    state = active_streams.get(session_id)

    if not state or state.done.is_set():
        # No active stream
        return {"status": "idle", "session_id": session_id}

    async def reconnect_generator():
        """Replay accumulated text then continue with live tokens."""
        # First, send all accumulated text as a single reconnect event
        if state.accumulated:
            yield f"data: {json.dumps({'reconnect': True, 'text': state.accumulated})}\n\n"

        # Start cursor after current tokens (we've already sent accumulated text)
        cursor = len(state.all_tokens)

        while True:
            # Yield any new tokens
            while cursor < len(state.all_tokens):
                data_json = state.all_tokens[cursor]
                cursor += 1
                yield f"data: {data_json}\n\n"
                data = json.loads(data_json) if isinstance(data_json, str) else data_json
                if data.get("done"):
                    return

            # If stream is done and we've yielded everything, exit
            if state.done.is_set() and cursor >= len(state.all_tokens):
                return

            # Wait for new tokens
            async with state.new_token:
                try:
                    await asyncio.wait_for(state.new_token.wait(), timeout=2.0)
                except asyncio.TimeoutError:
                    pass

    return StreamingResponse(
        reconnect_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
