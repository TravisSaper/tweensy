"""Styles people make themselves ("Your styles"), kept in styles.json next to settings.json so they
show up in every project. Built-in styles stay in guide.py."""

import json
import re
import time

from . import config
from .projects import slugify

LIMITS = {"label": 40, "note": 140, "text": 4000}


def path():
    return config.DATA / "styles.json"


def load():
    try:
        items = json.loads(path().read_text(encoding="utf-8"))
        return items if isinstance(items, list) else []
    except (OSError, ValueError):
        return []


def _write(items):
    config.DATA.mkdir(parents=True, exist_ok=True)
    tmp = path().with_suffix(".tmp")
    tmp.write_text(json.dumps(items, indent=1), encoding="utf-8")
    tmp.replace(path())


def save(data):
    """Add a style, or update it when `id` matches one. Raises ValueError with a message for the page."""
    label = str(data.get("label") or "").strip()
    note = str(data.get("note") or "").strip()
    text = str(data.get("text") or "").strip()
    if not label or not text:
        raise ValueError("Give your style a name and some rules.")
    if len(label) > LIMITS["label"] or len(note) > LIMITS["note"] or len(text) > LIMITS["text"]:
        raise ValueError("That's too long. Keep the name under 40 characters and the rules under 4000.")
    # Rules start with "STYLE: <name>" like the built-in ones, so Claude reads them the same way.
    text = re.sub(r"^\s*STYLE:[^\n]*\n?", "", text, flags=re.I).strip()
    text = f"STYLE: {label}\n{text}"
    items = load()
    old = next((s for s in items if s["id"] == data.get("id")), None)
    if old:
        old.update(label=label, note=note, text=text)
        style = old
    else:
        taken = {s["id"] for s in items}
        base = sid = "my-" + slugify(label)
        n = 2
        while sid in taken:
            sid, n = f"{base}-{n}", n + 1
        style = {"id": sid, "label": label, "note": note, "text": text, "t": time.time()}
        items.append(style)
    _write(items)
    return style


def delete(sid):
    items = load()
    kept = [s for s in items if s["id"] != sid]
    if len(kept) == len(items):
        return False
    _write(kept)
    return True
