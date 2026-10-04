"""Project folders, their saved chat history and settings, and the videos in them."""

import json
import re

from . import config

VIDEO_EXT = {".mp4", ".mov", ".webm", ".gif", ".m4v"}


def slugify(name):
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return slug[:48] or "project"


def project_dir(name):
    """Resolve a project folder, refusing anything outside the projects folder."""
    if not name or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", name):
        return None
    path = (config.PROJECTS / name).resolve()
    return path if path.parent == config.PROJECTS.resolve() and path.is_dir() else None


def create_project(name):
    """Make a new, empty project folder with a unique name based on `name`."""
    name = base = slugify(name)
    n = 2
    while (config.PROJECTS / name).exists():
        name, n = f"{base}-{n}", n + 1
    (config.PROJECTS / name).mkdir(parents=True)
    save_state(config.PROJECTS / name, {"session_id": None, "history": []})
    return name


def state_path(pdir):
    # Kept outside the project folder so it stays empty for `hyperframes init`.
    return config.STATE_DIR / f"{pdir.name}.json"


def load_state(pdir):
    try:
        return json.loads(state_path(pdir).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"session_id": None, "history": []}


def save_state(pdir, state):
    config.STATE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = state_path(pdir).with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=1), encoding="utf-8")
    tmp.replace(state_path(pdir))


def list_projects():
    config.PROJECTS.mkdir(exist_ok=True)
    items = []
    for p in config.PROJECTS.iterdir():
        if p.is_dir() and not p.name.startswith("."):
            items.append({"name": p.name, "mtime": p.stat().st_mtime})
    items.sort(key=lambda x: -x["mtime"])
    return items


def list_videos(pdir):
    out = []
    for f in pdir.rglob("*"):
        rel = f.relative_to(pdir)
        if any(part in ("node_modules", ".git") or part.startswith(".") for part in rel.parts):
            continue
        if f.is_file() and f.suffix.lower() in VIDEO_EXT and "snapshots" not in rel.parts:
            st = f.stat()
            out.append({"path": rel.as_posix(), "size": st.st_size, "mtime": st.st_mtime})
    out.sort(key=lambda x: -x["mtime"])
    # The prompt behind each video: the last message you sent before it was saved.
    asks = [(m.get("t", 0), m["text"]) for m in load_state(pdir).get("history", []) if m.get("role") == "user"]
    for v in out:
        v["prompt"] = next((text for t, text in reversed(asks) if t <= v["mtime"]), "")
    return out
