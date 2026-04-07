"""
Sessions router — list, create, read, update, delete, and stream chat.
"""
import json
import os
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()

SESSION_DIR = Path.home() / ".hermes" / "sessions"


class CreateSession(BaseModel):
    title: str | None = None
    model: str | None = None


class UpdateSession(BaseModel):
    title: str | None = None


class ChatMessage(BaseModel):
    role: str
    content: str


class SendMessage(BaseModel):
    message: str
    model: str | None = None


# ── helpers ──────────────────────────────────────────────────────────────────

def _session_files():
    """Return sorted list of session .jsonl files."""
    if not SESSION_DIR.exists():
        return []
    return sorted(
        [f for f in SESSION_DIR.iterdir() if f.suffix == ".jsonl"],
        key=lambda f: f.stat().st_mtime,
        reverse=True,
    )


def _load_session(session_id: str) -> list[dict]:
    """Load messages from a .jsonl session file."""
    path = SESSION_DIR / f"{session_id}.jsonl"
    if not path.exists():
        raise HTTPException(404, "Session not found")
    messages = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    messages.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return messages


def _save_message(session_id: str, msg: dict):
    """Append one JSON line to a session file."""
    path = SESSION_DIR / f"{session_id}.jsonl"
    with open(path, "a") as f:
        f.write(json.dumps(msg, ensure_ascii=False) + "\n")


# ── routes ───────────────────────────────────────────────────────────────────

@router.get("")
async def list_sessions():
    """List all sessions with metadata."""
    sessions = []
    for f in _session_files():
        try:
            # Quick preview: read last line for last message
            messages = _load_session(f.stem)
            last = messages[-1] if messages else None
            created = datetime.fromtimestamp(f.stat().st_ctime).isoformat()
            updated = datetime.fromtimestamp(f.stat().st_mtime).isoformat()
            sessions.append({
                "id": f.stem,
                "title": (messages[0]["content"][:60] if messages else "Empty session"),
                "message_count": len(messages),
                "created": created,
                "updated": updated,
                "last_message": last["content"][:120] if last else "",
                "model": messages[0].get("model") if messages else None,
            })
        except Exception:
            sessions.append({
                "id": f.stem,
                "title": f.name,
                "message_count": 0,
                "created": "",
                "updated": "",
                "last_message": "",
                "model": None,
            })
    return {"sessions": sessions}


@router.get("/{session_id}")
async def get_session(session_id: str):
    messages = _load_session(session_id)
    return {"id": session_id, "messages": messages}


@router.post("")
async def create_session(data: CreateSession):
    session_id = uuid.uuid4().hex[:12]
    path = SESSION_DIR / f"{session_id}.jsonl"
    path.touch()
    title = data.title or f"New session {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    return {"id": session_id, "title": title}


@router.put("/{session_id}")
async def update_session(session_id: str, data: UpdateSession):
    # Rename is stored as first message title; just return OK for now
    if data.title:
        messages = _load_session(session_id)
        if messages:
            messages[0]["title"] = data.title
            path = SESSION_DIR / f"{session_id}.jsonl"
            with open(path, "w") as f:
                for msg in messages:
                    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
    return {"id": session_id}


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    path = SESSION_DIR / f"{session_id}.jsonl"
    if path.exists():
        path.unlink()
    return {"deleted": session_id}


@router.post("/{session_id}/chat")
async def send_message(session_id: str, data: SendMessage):
    """Append user message and stream agent response."""
    import asyncio
    from api.streaming import _run_agent_streaming

    SESSION_DIR.mkdir(parents=True, exist_ok=True)

    user_msg = {"role": "user", "content": data.message}
    _save_message(session_id, user_msg)

    async def stream_response():
        # Use SSE format for streaming
        async for chunk in _run_agent_streaming(session_id, data.message, data.model):
            yield f"data: {json.dumps({'token': chunk})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
