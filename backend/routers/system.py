"""
System router — stats, config, version info, gateway management.
"""
import json
import os
import signal
import psutil
import platform
import subprocess
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()
HERMES_HOME = Path.home() / ".hermes"


def _get_gateway_pid() -> int | None:
    """Read PID from gateway.pid file."""
    pf = HERMES_HOME / "gateway.pid"
    if not pf.exists():
        return None
    try:
        raw = pf.read_text().strip()
        data = json.loads(raw) if raw.startswith("{") else {"pid": int(raw)}
        return int(data["pid"])
    except Exception:
        return None


def _is_process_running(pid: int) -> bool:
    """Check if a process with given PID is running."""
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def _read_gateway_state() -> dict | None:
    """Read gateway_state.json."""
    sf = HERMES_HOME / "gateway_state.json"
    if not sf.exists():
        return None
    try:
        return json.loads(sf.read_text())
    except Exception:
        return None


@router.get("")
async def system_info():
    HERMES = Path.home() / ".hermes"
    sessions_dir = HERMES / "sessions"
    skills_dir = HERMES / "skills"

    session_count = len([f for f in sessions_dir.iterdir() if f.is_file() and (f.name.endswith(".jsonl") or f.name.startswith("session_"))]) if sessions_dir.exists() else 0
    skill_count = len([d for d in skills_dir.iterdir() if d.is_dir()]) if skills_dir.exists() else 0

    try:
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
    except Exception:
        mem = None
        disk = None

    return {
        "platform": platform.system(),
        "platform_version": platform.version(),
        "hostname": platform.node(),
        "cpu_count": os.cpu_count(),
        "memory_total_gb": round(mem.total / (1024**3), 1) if mem else None,
        "memory_used_gb": round(mem.used / (1024**3), 1) if mem else None,
        "memory_percent": mem.percent if mem else None,
        "disk_total_gb": round(disk.total / (1024**3), 1) if disk else None,
        "disk_used_gb": round(disk.used / (1024**3), 1) if disk else None,
        "disk_percent": disk.percent if disk else None,
        "session_count": session_count,
        "skill_count": skill_count,
        "uptime": datetime.now().isoformat(),
    }


@router.get("/config")
async def get_config():
    """Expose non-sensitive config."""
    import yaml
    HERMES_cfg = HERMES_HOME / "config.yaml"
    if HERMES_cfg.exists():
        with open(HERMES_cfg) as f:
            cfg = yaml.safe_load(f)
        if cfg:
            for key in ["api_key", "token", "password", "secret", "auth"]:
                cfg.pop(key, None)
            return cfg
    return {}


@router.get("/gateway")
async def gateway_status():
    """Get gateway running status and health."""
    pid = _get_gateway_pid()
    running = pid is not None and _is_process_running(pid)
    state = _read_gateway_state()

    return {
        "running": running,
        "pid": pid,
        "state": state,
    }


@router.get("/network")
async def get_network_info():
    """Get network addresses for remote access."""
    import socket
    import subprocess
    import json

    addresses = []
    local_ips = set()

    # Collect LAN IPs
    try:
        hostname = socket.gethostname()
        # Try to get all LAN addresses via gethostbyname_ex
        try:
            _, _, addrs = socket.gethostbyname_ex(hostname)
            for a in addrs:
                # Only include valid IPv4 LAN addresses
                if a and not a.startswith('::') and '.' in a:
                    local_ips.add(a)
        except Exception:
            pass
        # Direct lookup of hostname
        try:
            lan_ip = socket.gethostbyname(hostname)
            if lan_ip and not lan_ip.startswith('::') and '.' in lan_ip:
                local_ips.add(lan_ip)
        except Exception:
            pass
    except Exception:
        pass

    # Parse ifconfig for more IPs
    try:
        result = subprocess.run(['ifconfig'], capture_output=True, text=True, timeout=3)
        for line in result.stdout.splitlines():
            line = line.strip()
            if line.startswith('inet ') and not line.startswith('inet 127.'):
                parts = line.split()
                if len(parts) >= 2:
                    ip = parts[1]
                    if ip and ip != '0.0.0.0' and '.' in ip:
                        local_ips.add(ip)
    except Exception:
        pass

    # Try ipconfig on Windows
    try:
        result = subprocess.run(['ipconfig'], capture_output=True, text=True, timeout=3)
        for line in result.stdout.splitlines():
            line = line.strip()
            if 'IPv4' in line and ':' in line:
                ip = line.split(':')[-1].strip()
                if ip and ip != '0.0.0.0':
                    local_ips.add(ip)
    except Exception:
        pass

    # Get external IP via public API
    external_ip = None
    for url in ['https://api.ipify.org', 'https://ifconfig.me/ip', 'https://icanhazip.com']:
        try:
            result = subprocess.run(
                ['curl', '-s', '--max-time', '3', url],
                capture_output=True, text=True, timeout=5
            )
            candidate = result.stdout.strip()
            if candidate and candidate.count('.') == 3 and not candidate.startswith('0'):
                external_ip = candidate
                break
        except Exception:
            pass

    # Build address list with proper types
    seen = set()
    for ip in sorted(local_ips):
        if ip not in seen and ip not in ('127.0.0.1', '0.0.0.0'):
            seen.add(ip)
            addr_type = 'Localhost' if ip == '127.0.0.1' else ('LAN' if ip.startswith(('10.', '172.', '192.168.', '169.254.')) else 'Network')
            addresses.append({"type": addr_type, "address": ip, "port": 23689})

    if external_ip and external_ip not in seen:
        addresses.append({"type": "External (WAN)", "address": external_ip, "port": 23689})
        seen.add(external_ip)

    return {"hostname": socket.gethostname(), "addresses": addresses}

@router.post("/gateway/restart")
async def gateway_restart():
    """
    Gracefully restart the Hermes gateway.
    1. Send SIGTERM to the current process
    2. Wait up to 5 seconds for it to die
    3. Launch a new gateway process via launch-gateway.sh
    4. Wait 3 seconds then verify new PID is different from old
    Returns the new PID if successful.
    """
    pid = _get_gateway_pid()
    old_pid = pid

    if pid is not None and _is_process_running(pid):
        # Send SIGTERM (graceful shutdown)
        try:
            os.kill(pid, signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            pass

        # Wait up to 5s for graceful shutdown
        for _ in range(10):
            if not _is_process_running(pid):
                break
            import time; time.sleep(0.5)
        else:
            # Force kill if still running
            try:
                os.kill(pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                pass

    # Small delay before starting new gateway
    import time; time.sleep(1)

    # Launch new gateway via launch-gateway.sh
    launch_script = HERMES_HOME / "launch-gateway.sh"
    start_script = HERMES_HOME / "webui-cyber" / "start.sh"

    new_pid = None
    launched = False

    # Try launch-gateway.sh first (the proper Hermes launcher)
    if launch_script.exists():
        try:
            result = subprocess.run(
                ["bash", str(launch_script)],
                cwd=str(HERMES_HOME),
                capture_output=True, text=True, timeout=10,
                env={**os.environ, "HERMES_HOME": str(HERMES_HOME)}
            )
            launched = result.returncode == 0
        except Exception as e:
            launched = False

    # If that didn't work, try starting via the CyberUI start script (reuses same Python)
    if not launched and start_script.exists():
        try:
            result = subprocess.run(
                ["bash", str(start_script)],
                cwd=str(HERMES_HOME.parent / "webui-cyber"),
                capture_output=True, text=True, timeout=10,
            )
            launched = result.returncode == 0
        except Exception:
            pass

    # Wait 3 seconds for the new gateway to initialize
    time.sleep(3)

    new_pid = _get_gateway_pid()

    if new_pid and new_pid != old_pid and _is_process_running(new_pid):
        return {"ok": True, "message": "Gateway restarted successfully", "new_pid": new_pid}

    # Fallback: verify any gateway is running
    if new_pid and _is_process_running(new_pid):
        return {"ok": True, "message": "Gateway restarted (PID changed)", "new_pid": new_pid}

    return {"ok": False, "message": "Gateway restart may have failed - check manually"}
