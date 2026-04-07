"""
Multi-agent router — read multi-agent config and agent status.
"""
import yaml
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()
CONFIG_FILE = Path.home() / ".hermes" / "multi-agent" / "config.yaml"

# Sensitive keys that must never be sent to the frontend
_SENSITIVE_KEYS = frozenset({
    "api_key", "api-key", "api_secret", "api-secret",
    "token", "access_token", "access-token",
    "refresh_token", "refresh-token",
    "secret", "secret_key", "secret-key",
    "password", "passphrase",
    "private_key", "private-key",
    "auth", "authorization",
})


def _sanitize_config(cfg: dict) -> dict:
    """Remove sensitive keys from a config dict before sending to the frontend."""
    result = {}
    for k, v in cfg.items():
        k_lower = k.lower().replace("-", "_").replace(" ", "_")
        if k_lower in _SENSITIVE_KEYS or k_lower.endswith("_token") or k_lower.endswith("_key") or k_lower.endswith("_secret"):
            result[k] = "[REDACTED]"
        elif isinstance(v, dict):
            result[k] = _sanitize_config(v)
        elif isinstance(v, list):
            result[k] = [
                _sanitize_config(item) if isinstance(item, dict) else item
                for item in v
            ]
        else:
            result[k] = v
    return result


@router.get("/", response_model=dict)
async def get_multiagent_overview():
    """Get overview: config + agents combined."""
    if not CONFIG_FILE.exists():
        raise HTTPException(404, "Multi-agent config not found")
    cfg = yaml.safe_load(CONFIG_FILE.read_text()) or {}
    agents = cfg.get("agents", {})
    channels = cfg.get("channels", {})
    agent_list = []
    for name, info in agents.items():
        channel_id = info.get("channel", "")
        channel_name = ""
        for cname, cid in channels.items():
            if cid == channel_id:
                channel_name = cname
                break
        agent_list.append({
            "name": name,
            "display_name": info.get("name", name),
            "model": info.get("model"),
            "fallback": info.get("fallback"),
            "channel_id": channel_id,
            "channel_name": channel_name,
            "description": info.get("description"),
            "status": "unknown",
        })
    return {"config": _sanitize_config(cfg), "agents": agent_list, "state": cfg.get("state", "unknown")}


@router.get("/config")
async def get_multiagent_config():
    """Get the full multi-agent configuration."""
    if not CONFIG_FILE.exists():
        raise HTTPException(404, "Multi-agent config not found")
    cfg = yaml.safe_load(CONFIG_FILE.read_text()) or {}
    return {"config": _sanitize_config(cfg), "file": str(CONFIG_FILE)}


def _get_channel_name(channel_val: str, channels: dict) -> str:
    """Convert channel value (like '2-ideas', 'research_raw', or channel ID) to a display name.
    
    The config stores channel as '2-ideas' style (Discord forum channel key),
    'research_raw' style (channel name), or a raw channel ID.
    We resolve 'N-name' to 'name' for Discord forum channels, or match directly.
    """
    if not channel_val:
        return ""
    # Direct match against channel names (e.g. "ideas", "orchestrator", "research_raw")
    if channel_val in channels:
        return channel_val
    # Try to match against channel IDs to get the name
    for cname, cid in channels.items():
        if cid == channel_val:
            return cname
    # Handle Discord forum short-form: "2-ideas" -> "ideas", "3-research_raw" -> "research_raw"
    # Pattern: starts with digit(s) then dash then name
    if '-' in channel_val:
        parts = channel_val.split('-', 1)
        if len(parts) == 2 and parts[0].isdigit():
            short_name = parts[1]  # e.g. "ideas" from "2-ideas"
            if short_name in channels:
                return short_name
            return short_name  # Return the short name even if not found in channels dict
    return channel_val


@router.get("/agents")
async def list_agents():
    """List all configured sub-agents."""
    if not CONFIG_FILE.exists():
        raise HTTPException(404, "Multi-agent config not found")
    cfg = yaml.safe_load(CONFIG_FILE.read_text()) or {}
    agents = cfg.get("agents", {})
    channels = cfg.get("channels", {})

    # Build a reverse map: channel_id -> channel_name for IDs
    channel_id_to_name = {v: k for k, v in channels.items()}

    result = []
    for name, info in agents.items():
        channel_val = info.get("channel", "")
        # channel_name should be the human-readable name like "ideas"
        channel_name = _get_channel_name(channel_val, channels)
        result.append({
            "name": name,
            "display_name": info.get("name", name),
            "model": info.get("model"),
            "fallback": info.get("fallback"),
            "channel_id": channel_val,
            "channel_name": channel_name,
            "description": info.get("description"),
            "status": "unknown",
        })
    return {"agents": result, "state": cfg.get("state", "unknown")}


@router.put("/config")
async def update_multiagent_config(data: dict):
    """Update multi-agent config (partial merge)."""
    if not CONFIG_FILE.exists():
        raise HTTPException(404, "Multi-agent config not found")
    current = yaml.safe_load(CONFIG_FILE.read_text()) or {}
    # Merge
    for k, v in data.items():
        if isinstance(v, dict) and k in current and isinstance(current[k], dict):
            current[k].update(v)
        else:
            current[k] = v
    CONFIG_FILE.write_text(yaml.dump(current, default_flow_style=False, sort_keys=False))
    return {"ok": True}
