"""
Skills router — fully standalone.
List, read, create, update, delete skill directories.
"""
import re
import shutil
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
SKILLS_DIR = Path.home() / ".hermes" / "skills"


class CreateSkill(BaseModel):
    name: str
    description: str = ""


class UpdateSkill(BaseModel):
    content: str | None = None
    description: str | None = None


def _list_skills():
    if not SKILLS_DIR.exists():
        return []
    skills = []
    for d in sorted(SKILLS_DIR.iterdir()):
        if not d.is_dir():
            continue
        # Skip hidden and cache directories
        if d.name.startswith(".") or d.name == "__pycache__":
            continue
        skill_md = d / "SKILL.md"
        readme = d / "README.md"
        desc = ""
        if skill_md.exists():
            content = skill_md.read_text()
            for line in content.splitlines():
                line = line.strip()
                if line.startswith("# "):
                    desc = line[2:].strip()[:120]
                    break
                elif line and not line.startswith("#"):
                    desc = line[:120]
                    break
        elif readme.exists():
            desc = readme.read_text().split("\n")[0][-120:]
        skills.append({
            "name": d.name,
            "description": desc,
            "path": str(d),
            "has_skill_md": skill_md.exists(),
            "has_readme": readme.exists(),
        })
    return skills


@router.get("")
async def list_skills():
    return {"skills": _list_skills()}


@router.get("/{name}")
async def get_skill(name: str):
    path = SKILLS_DIR / name
    if not path.exists():
        raise HTTPException(404, f"Skill '{name}' not found")
    skill_md = path / "SKILL.md"
    readme = path / "README.md"
    return {
        "name": name,
        "path": str(path),
        "skill_md": skill_md.read_text() if skill_md.exists() else "",
        "readme": readme.read_text() if readme.exists() else "",
        "description": "",
        "has_skill_md": skill_md.exists(),
        "has_readme": readme.exists(),
    }


@router.put("/{name}")
async def update_skill(name: str, data: UpdateSkill):
    path = SKILLS_DIR / name
    if not path.exists():
        raise HTTPException(404, f"Skill '{name}' not found")
    if data.content is not None:
        skill_md = path / "SKILL.md"
        skill_md.write_text(data.content)
    return {"name": name, "updated": True}


@router.post("")
async def create_skill(data: CreateSkill):
    safe_name = re.sub(r"[^a-z0-9_\-]", "-", data.name.lower().strip())
    path = SKILLS_DIR / safe_name
    if path.exists():
        raise HTTPException(409, f"Skill '{safe_name}' already exists")
    path.mkdir(parents=True, exist_ok=True)
    content = f"""# {data.name}

{data.description or "No description provided."}

## Triggers
When to use this skill:

## Steps
1. Step one
2. Step two

## Verification
How to verify it worked:
"""
    (path / "SKILL.md").write_text(content.strip())
    return {"name": safe_name, "path": str(path)}


@router.delete("/{name}")
async def delete_skill(name: str):
    path = SKILLS_DIR / name
    if not path.exists():
        raise HTTPException(404, f"Skill '{name}' not found")
    shutil.rmtree(path)
    return {"deleted": name}
