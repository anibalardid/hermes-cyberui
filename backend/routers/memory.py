"""
Memory router — fully standalone. Read and update MEMORY.md and USER.md.
"""
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()
MEMORY_DIR = Path.home() / ".hermes" / "memories"


class SaveMemory(BaseModel):
    memory: str | None = None
    user: str | None = None


@router.get("")
async def get_memory():
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    mem_path = MEMORY_DIR / "MEMORY.md"
    user_path = MEMORY_DIR / "USER.md"
    return {
        "memory": mem_path.read_text() if mem_path.exists() else "",
        "user": user_path.read_text() if user_path.exists() else "",
    }


@router.put("")
async def save_memory(data: SaveMemory):
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    if data.memory is not None:
        (MEMORY_DIR / "MEMORY.md").write_text(data.memory)
    if data.user is not None:
        (MEMORY_DIR / "USER.md").write_text(data.user)
    return {"saved": True}
