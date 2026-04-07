#!/bin/bash
# Hermes CyberUI — Start Script
# Run: bash start.sh

set -e

CYBER_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$CYBER_DIR/backend"
VENV_DIR="$BACKEND_DIR/venv"

# Detect local IP (skip Docker/loopback interfaces)
detect_ip() {
    local_ip=$(ifconfig 2>/dev/null | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
    if [ -z "$local_ip" ]; then
        local_ip="<unknown-ip>"
    fi
    echo "$local_ip"
}

LOCAL_IP=$(detect_ip)

# Use Python 3.12 explicitly (3.14 breaks pydantic-core builds)
PYTHON="/opt/homebrew/bin/python3.12"

echo "Starting Hermes CyberUI..."
echo "   Local:  http://localhost:23689"
echo "   Network: http://$LOCAL_IP:23689"

# Always check if venv python is a working 3.10-3.13 version
DO_RECREATE=0
if [ -f "$VENV_DIR/bin/python" ]; then
    VENV_PYTHON_VERSION=$("$VENV_DIR/bin/python" --version 2>&1 | awk '{print $2}')
    if [[ ! "$VENV_PYTHON_VERSION" =~ ^3\.(10|11|12|13) ]]; then
        echo "Detected venv with Python $VENV_PYTHON_VERSION (unsupported). Recreating with 3.12..."
        DO_RECREATE=1
    fi
else
    echo "No venv found. Creating..."
    DO_RECREATE=1
fi

if [ "$DO_RECREATE" = "1" ]; then
    rm -rf "$VENV_DIR"
    "$PYTHON" -m venv "$VENV_DIR"
fi

# Install deps
echo "Installing Python dependencies..."
"$VENV_DIR/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"

# Start backend
echo "Starting backend on port 23689..."
cd "$BACKEND_DIR"
nohup "$VENV_DIR/bin/python" -m uvicorn main:app --port 23689 --host 0.0.0.0 > /tmp/hermes-cyber-backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

sleep 2

# Check if backend started
if curl -s http://localhost:23689/health > /dev/null 2>&1; then
    echo "Backend is up: http://localhost:23689"
else
    echo "Backend failed to start. Check /tmp/hermes-cyber-backend.log"
    cat /tmp/hermes-cyber-backend.log
    exit 1
fi

echo ""
echo "Hermes CyberUI is running!"
echo "Open: http://localhost:23689"
echo "Network: http://$LOCAL_IP:23689"
echo "Logs: tail -f /tmp/hermes-cyber-backend.log"
