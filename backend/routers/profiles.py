"""
Profiles router — manage Hermes profiles (~/.hermes/profiles/).
"""
import json
import yaml
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
HERMES_HOME = Path.home() / ".hermes"
PROFILES_DIR = HERMES_HOME / "profiles"


class CreateProfileRequest(BaseModel):
    name: str
    description: str | None = None
    model: str | None = None
    provider: str | None = None


class UpdateProfileRequest(BaseModel):
    description: str | None = None
    model: str | None = None
    provider: str | None = None
    extra: dict | None = None


def _get_active_profile_name() -> str | None:
    """Read the sticky active_profile file. Returns None if not set."""
    ap = HERMES_HOME / "active_profile"
    if ap.exists():
        try:
            name = ap.read_text().strip()
            return name if name else None
        except Exception:
            pass
    return None


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


def _read_config_model(profile_dir: Path) -> tuple[str | None, str | None]:
    """Read model and provider from a config.yaml file."""
    cfg_path = profile_dir / "config.yaml"
    if not cfg_path.exists():
        return None, None
    try:
        cfg = yaml.safe_load(cfg_path.read_text()) or {}
        mc = cfg.get("model", {})
        if isinstance(mc, str):
            return mc, cfg.get("provider")
        if isinstance(mc, dict):
            return mc.get("default") or mc.get("model"), mc.get("provider")
        return None, None
    except Exception:
        return None, None


@router.get("")
async def list_profiles():
    """List all profiles including the default (~/.hermes)."""
    active_name = _get_active_profile_name()

    profiles = []

    # Default profile (~/.hermes)
    model, provider = _read_config_model(HERMES_HOME)
    profiles.append({
        "name": "default",
        "path": str(HERMES_HOME),
        "description": "",
        "model": model,
        "provider": provider,
        "is_default": active_name is None,  # default is active if no sticky file
        "is_active": active_name is None,
    })

    # Named profiles
    if PROFILES_DIR.exists():
        for d in sorted(PROFILES_DIR.iterdir()):
            if not d.is_dir():
                continue
            model, provider = _read_config_model(d)
            is_active = d.name == active_name
            profiles.append({
                "name": d.name,
                "path": str(d),
                "description": "",
                "model": model,
                "provider": provider,
                "is_default": False,
                "is_active": is_active,
            })

    return {"profiles": profiles, "active": active_name or "default"}


@router.get("/{name}")
async def get_profile(name: str):
    """Get full profile config."""
    if name == "default":
        profile_dir = HERMES_HOME
    else:
        profile_dir = PROFILES_DIR / name
    if not profile_dir.exists():
        raise HTTPException(404, "Profile not found")
    config_file = profile_dir / "config.yaml"
    cfg = {}
    if config_file.exists():
        try:
            cfg = yaml.safe_load(config_file.read_text()) or {}
        except Exception:
            pass
    cfg = _sanitize_config(cfg)
    return {"name": name, "path": str(profile_dir), "config": cfg}


@router.post("")
async def create_profile(data: CreateProfileRequest):
    """Create a new profile directory with config.yaml."""
    name = data.name
    if not name:
        raise HTTPException(400, "name is required")
    if not PROFILES_DIR.exists():
        PROFILES_DIR.mkdir(parents=True)
    path = PROFILES_DIR / name
    if path.exists():
        raise HTTPException(409, f"Profile '{name}' already exists")
    path.mkdir(parents=True)
    cfg = {"description": data.description or "", "model": data.model or "", "provider": data.provider or ""}
    (path / "config.yaml").write_text(yaml.dump(cfg, default_flow_style=False))
    return {"ok": True, "name": name}


@router.put("/{name}")
async def update_profile(name: str, data: UpdateProfileRequest):
    """Update profile config.yaml (partial update)."""
    if name == "default":
        profile_dir = HERMES_HOME
    else:
        profile_dir = PROFILES_DIR / name
    if not profile_dir.exists():
        raise HTTPException(404, "Profile not found")
    config_file = profile_dir / "config.yaml"
    cfg = {}
    if config_file.exists():
        try:
            cfg = yaml.safe_load(config_file.read_text()) or {}
        except Exception:
            pass
    if data.description is not None:
        cfg["description"] = data.description
    if data.model is not None:
        cfg.setdefault("model", {})["default"] = data.model
    if data.provider is not None:
        cfg.setdefault("model", {})["provider"] = data.provider
    if data.extra:
        cfg.update(data.extra)
    config_file.write_text(yaml.dump(cfg, default_flow_style=False, sort_keys=False))
    return {"ok": True}


@router.post("/{name}/activate")
async def activate_profile(name: str):
    """Set a profile as the active (default) profile via sticky file."""
    if name == "default":
        ap = HERMES_HOME / "active_profile"
        if ap.exists():
            ap.unlink()
        return {"ok": True, "active": "default"}
    if not (PROFILES_DIR / name).exists():
        raise HTTPException(404, "Profile not found")
    ap = HERMES_HOME / "active_profile"
    ap.write_text(name + "\n")
    return {"ok": True, "active": name}
