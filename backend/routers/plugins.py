"""
Plugins router — enumerate Hermes plugins from ~/.hermes/plugins/
"""
import json
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()
PLUGINS_DIR = Path.home() / ".hermes" / "plugins"


def _read_meta(plugin_path: Path) -> dict:
    meta_file = plugin_path / "METADATA.json"
    if meta_file.exists():
        try:
            return json.loads(meta_file.read_text())
        except Exception:
            pass
    return {}


def _list_plugins():
    if not PLUGINS_DIR.exists():
        return []
    plugins = []
    for d in sorted(PLUGINS_DIR.iterdir()):
        if not d.is_dir():
            continue
        meta = _read_meta(d)
        # Try to find a README
        readme = d / "README.md"
        desc = ""
        if readme.exists():
            lines = readme.read_text().splitlines()
            desc = next((l.strip() for l in lines if l.strip()), "")
        plugins.append({
            "name": d.name,
            "path": str(d),
            "description": meta.get("description", desc[:100]),
            "version": meta.get("version"),
            "author": meta.get("author"),
        })
    return plugins


@router.get("")
async def list_plugins():
    return {"plugins": _list_plugins()}


@router.get("/{name}")
async def get_plugin(name: str):
    path = PLUGINS_DIR / name
    if not path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, "Plugin not found")
    meta = _read_meta(path)
    readme = path / "README.md"
    config = path / "config.json"
    return {
        "name": name,
        "path": str(path),
        "metadata": meta,
        "readme": readme.read_text() if readme.exists() else "",
        "config": config.read_text() if config.exists() else "",
    }
