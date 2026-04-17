"""
Hermes Cyberpunk WebUI — FastAPI Backend
"""
import os
import sys
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

# Try to add hermes-webui to path for API reuse
HERMES_WEBUI = Path.home() / ".hermes" / "hermes-webui"
if HERMES_WEBUI.exists():
    sys.path.insert(0, str(HERMES_WEBUI))

from routers.sessions import router as sessions_router
from routers.skills import router as skills_router
from routers.memory import router as memory_router
from routers.crons import router as crons_router
from routers.plugins import router as plugins_router
from routers.logs import router as logs_router
from routers.profiles import router as profiles_router
from routers.multiagent import router as multiagent_router
from routers.system import router as system_router
from routers.files import router as files_router
from routers.jobs import router as jobs_router
from routers.config import router as config_router
from routers.tasks import router as tasks_router, _clear_all_task_locks, _reset_stale_in_progress_tasks


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[CyberUI] Backend starting...")
    _clear_all_task_locks()  # Reset stale execution state from previous runs
    _reset_stale_in_progress_tasks()  # Reset tasks stuck in in_progress from crashed runs
    yield
    print("[CyberUI] Backend shutting down...")


app = FastAPI(
    title="Hermes Cyberpunk WebUI",
    description="Manage Hermes — sessions, skills, memory, tools",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
        "http://localhost:4173",
        "http://localhost:23689",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routers FIRST (so they take precedence over static files)
app.include_router(sessions_router, prefix="/api/sessions", tags=["sessions"])
app.include_router(skills_router, prefix="/api/skills", tags=["skills"])
app.include_router(memory_router, prefix="/api/memory", tags=["memory"])
app.include_router(crons_router, prefix="/api/crons", tags=["crons"])
app.include_router(plugins_router, prefix="/api/plugins", tags=["plugins"])
app.include_router(logs_router, prefix="/api/logs", tags=["logs"])
app.include_router(profiles_router, prefix="/api/profiles", tags=["profiles"])
app.include_router(multiagent_router, prefix="/api/multiagent", tags=["multiagent"])
app.include_router(system_router, prefix="/api/system", tags=["system"])
app.include_router(files_router, prefix="/api/files", tags=["files"])
app.include_router(jobs_router, prefix="/api/jobs", tags=["jobs"])
app.include_router(config_router, prefix="/api/config", tags=["config"])
app.include_router(tasks_router, prefix="/api/tasks", tags=["tasks"])

# Health check
@app.get("/health")
async def health():
    return {"status": "ok", "service": "hermes-cyber-ui"}

# Paths
static_path = Path(__file__).parent.parent / "frontend" / "dist"
public_path = Path(__file__).parent.parent / "frontend" / "public"

# Serve cyber.css from public/ directory
@app.get("/cyber.css")
async def serve_cyber_css():
    css_file = public_path / "cyber.css"
    if css_file.exists():
        return FileResponse(str(css_file), media_type="text/css")
    return JSONResponse({"detail": "Not found"}, status_code=404)

# Serve static assets directly (JS, CSS, fonts, etc.)
if static_path.exists():
    app.mount("/assets", StaticFiles(directory=str(static_path / "assets"), html=False), name="assets")

# SPA catch-all — must be LAST so API routes take precedence
# Replicates StaticFiles(html=True) behavior manually for reliability
@app.get("/{path:path}")
async def spa_fallback(path: str):
    if path.startswith("api/"):
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    file_path = static_path / path
    if file_path.is_file():
        return FileResponse(str(file_path))
    index_path = static_path / "index.html"
    if index_path.is_file():
        return FileResponse(str(index_path))
    return JSONResponse({"detail": "Not Found"}, status_code=404)

@app.get("/")
async def serve_index():
    index_path = static_path / "index.html"
    if index_path.is_file():
        return FileResponse(str(index_path))
    return JSONResponse({"detail": "index.html not found"}, status_code=404)
