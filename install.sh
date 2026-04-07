#!/bin/bash
# Hermes CyberUI — Install + Launch Script
# Run: bash install.sh

set -e

CYBER_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$CYBER_DIR/backend"
FRONTEND_DIR="$CYBER_DIR/frontend"
VENV_DIR="$BACKEND_DIR/venv"
PYTHON="/opt/homebrew/bin/python3.12"

echo "=== Hermes CyberUI Installer ==="

# ── Python venv ────────────────────────────────────────────────────────────
echo "[1/4] Setting up Python environment..."
if [ ! -f "$VENV_DIR/bin/python" ]; then
    echo "  Creating Python 3.12 venv..."
    "$PYTHON" -m venv "$VENV_DIR"
else
    VENV_VER=$("$VENV_DIR/bin/python" --version 2>&1 | awk '{print $2}')
    if [[ ! "$VENV_VER" =~ ^3\.(10|11|12|13) ]]; then
        echo "  Recreating venv (detected $VENV_VER)..."
        rm -rf "$VENV_DIR"
        "$PYTHON" -m venv "$VENV_DIR"
    fi
fi

echo "  Installing Python dependencies..."
"$VENV_DIR/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"

# ── Frontend deps ───────────────────────────────────────────────────────────
echo "[2/4] Installing frontend dependencies..."
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "  Running npm install..."
    cd "$FRONTEND_DIR" && npm install
else
    echo "  node_modules already present, skipping."
fi

# ── Build frontend ─────────────────────────────────────────────────────────
echo "[3/4] Building frontend..."
cd "$FRONTEND_DIR" && npm run build

# ── Start backend ───────────────────────────────────────────────────────────
echo "[4/4] Starting backend on port 23689..."
cd "$BACKEND_DIR"

# Kill any existing backend on 23689
EXISTING=$(lsof -ti :23689 2>/dev/null || true)
if [ -n "$EXISTING" ]; then
    echo "  Killing previous process on port 23689 (PID $EXISTING)..."
    kill $EXISTING 2>/dev/null || true
    sleep 1
fi

nohup "$VENV_DIR/bin/python" -m uvicorn main:app --port 23689 --host 127.0.0.1 > /tmp/hermes-cyber-backend.log 2>&1 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

sleep 3

# ── Health check ───────────────────────────────────────────────────────────
if curl -s http://localhost:23689/health > /dev/null 2>&1; then
    echo ""
    echo "=========================================="
    echo "  Hermes CyberUI is LIVE"
    echo "  Open: http://localhost:23689"
    echo "  Backend PID: $BACKEND_PID"
    echo "  Logs: tail -f /tmp/hermes-cyber-backend.log"
    echo "=========================================="
else
    echo ""
    echo "  Backend failed to start. Check:"
    echo "  tail /tmp/hermes-cyber-backend.log"
    exit 1
fi
