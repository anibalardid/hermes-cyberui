"""
Tools router — enumerate all Hermes tools with their signatures.
"""
import inspect
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()

TOOLS = []

try:
    from hermes_tools import (
        web_search, web_extract, read_file, write_file, patch,
        search_files, terminal, execute_code, vision_analyze,
        text_to_speech, browser_navigate, browser_snapshot,
        browser_click, browser_type, browser_scroll, browser_press,
        browser_vision, browser_close, browser_back, browser_console,
        delegate_task, cronjob, skill_view, skill_manage, skills_list,
        memory, session_search, todo,
    )
    TOOLS = [
        web_search, web_extract, read_file, write_file, patch,
        search_files, terminal, execute_code, vision_analyze,
        text_to_speech, browser_navigate, browser_snapshot,
        browser_click, browser_type, browser_scroll, browser_press,
        browser_vision, browser_close, browser_back, browser_console,
        delegate_task, cronjob, skill_view, skill_manage, skills_list,
        memory, session_search, todo,
    ]
except ImportError:
    pass


def _get_tools():
    """Serialize tool signatures for the frontend."""
    result = []
    for tool in TOOLS:
        try:
            sig = inspect.signature(tool)
            params = []
            for pname, pval in sig.parameters.items():
                params.append({
                    "name": pname,
                    "kind": str(pval.kind.name),
                    "default": str(pval.default) if pval.default is not inspect.Parameter.empty else None,
                    "annotation": str(pval.annotation) if pval.annotation is not inspect.Parameter.empty else None,
                })
            result.append({
                "name": tool.__name__,
                "description": (tool.__doc__ or "").strip().split("\n")[0][:200],
                "params": params,
            })
        except Exception:
            result.append({
                "name": getattr(tool, "__name__", str(tool)),
                "description": "",
                "params": [],
            })
    return result


@router.get("")
async def list_tools():
    return {"tools": _get_tools()}
