#!/bin/bash
# Hermes CyberUI — Stop Script
# Run: bash stop.sh

echo "=== Stopping Hermes CyberUI ==="

# Kill backend on port 23689
PID=$(lsof -ti :23689 2>/dev/null || true)
if [ -n "$PID" ]; then
    echo "Killing backend (PID $PID) on port 23689..."
    kill $PID 2>/dev/null && echo "Done." || echo "Process already gone."
else
    echo "No process found on port 23689."
fi

# Also kill any uvicorn processes related to this project
UV_PIDS=$(ps aux | grep "uvicorn.*hermes.*cyber" | grep -v grep | awk '{print $2}' || true)
if [ -n "$UV_PIDS" ]; then
    echo "Killing uvicorn processes: $UV_PIDS"
    echo $UV_PIDS | xargs kill 2>/dev/null || true
fi

echo "Hermes CyberUI stopped."
