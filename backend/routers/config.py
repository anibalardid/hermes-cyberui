"""
Config router — read and display Hermes config.yaml sections.
Mirrors hermes-overwatch's config page structure.
"""
import yaml
from pathlib import Path
from fastapi import APIRouter

router = APIRouter()
HERMES_HOME = Path.home() / ".hermes"

# Sensitive keys to redact
_SENSITIVE_KEYS = frozenset([
    "api_key", "token", "password", "secret", "auth", "bearer",
    "signature", "private_key", "client_secret", "session_token",
    "access_token", "refresh_token", "api_secret", "encryption_key",
    "jwt_secret", "oauth_token", "credential", "x-api-key",
])


def _redact(data):
    """Recursively redact sensitive keys."""
    if isinstance(data, dict):
        return {k: _redact(v) if k not in _SENSITIVE_KEYS else "••••••••" for k, v in data.items()}
    if isinstance(data, list):
        return [_redact(item) for item in data]
    return data


def _read_yaml(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        with open(path) as f:
            return yaml.safe_load(f) or {}
    except Exception:
        return None


@router.get("")
async def get_config():
    """Return full config.yaml split into named sections (like hermes-overwatch)."""
    cfg = _read_yaml(HERMES_HOME / "config.yaml")
    if not cfg:
        return {"error": "config.yaml not found"}, 404

    raw = cfg

    def safe_section(key: str):
        val = raw.get(key)
        if val is None:
            return {}
        if isinstance(val, dict):
            return _redact(val)
        return {"value": val}

    return {
        "sections": {
            "model":       safe_section("model"),
            "display":     safe_section("display"),
            "terminal":    safe_section("terminal"),
            "tts":         _redact(safe_section("tts")),
            "stt":         safe_section("stt"),
            "memory":      safe_section("memory"),
            "browser":     safe_section("browser"),
            "mcp_servers": _redact(safe_section("mcp_servers")),
            "delegation":  safe_section("delegation"),
            "compression": safe_section("compression"),
            "cron":        safe_section("cron"),
            "security":    _redact(safe_section("security")),
        },
        "configVersion": raw.get("_config_version"),
        "full": _redact(raw),
    }
