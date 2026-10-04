"""Render versions: every turn renders to a new renders/vNNN.mp4, and each version keeps a small
copy of the composition's source so it can be restored, not just watched.

Records live in the project's chat state (projects/.chats/<name>.json) under "versions", with
"current" pointing at the version the project files match.
"""

import json
import re
import shutil

from . import system

SOURCE_EXT = {".html", ".css", ".js", ".mjs", ".json", ".md", ".svg", ".txt"}
SKIP_DIRS = {"renders", "node_modules", ".git", ".tweensy", "snapshots", "sketches"}
MAX_SOURCE_BYTES = 2_000_000


def video_path(n):
    return f"renders/v{n:03d}.mp4"


def next_number(pdir, state):
    """The next free version number. Never reuses a number whose file already exists."""
    taken = [v["n"] for v in state.get("versions", [])]
    for f in (pdir / "renders").glob("v*.mp4"):
        m = re.fullmatch(r"v(\d+)\.mp4", f.name)
        if m:
            taken.append(int(m.group(1)))
    return max(taken, default=0) + 1


def probe(path):
    """Duration, size and frame rate of a video, via ffprobe (ships with FFmpeg). Blank if unavailable."""
    _, out = system.run_quiet(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                               "stream=width,height,r_frame_rate:format=duration", "-of", "json", str(path)])
    try:
        data = json.loads(out or "{}")
        stream = data["streams"][0]
        num, den = stream.get("r_frame_rate", "0/1").split("/")
        return {"duration": round(float(data["format"]["duration"]), 2), "width": stream["width"],
                "height": stream["height"], "fps": round(int(num) / max(int(den), 1), 2)}
    except (ValueError, KeyError, IndexError, TypeError):
        return {"duration": None, "width": None, "height": None, "fps": None}


def _source_files(pdir):
    for f in pdir.rglob("*"):
        rel = f.relative_to(pdir)
        if (f.is_file() and f.suffix.lower() in SOURCE_EXT and not (set(rel.parts[:-1]) & SKIP_DIRS)
                and not rel.parts[0].startswith(".") and f.stat().st_size <= MAX_SOURCE_BYTES):
            yield rel


def snapshot_dir(pdir, n):
    return pdir / ".tweensy" / "versions" / f"v{n:03d}"


def snapshot(pdir, n):
    """Copy the composition's source files (small text files) for version n."""
    dest = snapshot_dir(pdir, n)
    for rel in _source_files(pdir):
        (dest / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(pdir / rel, dest / rel)


def restore(pdir, n):
    """Put version n's source files back. Returns False if it has no snapshot."""
    src = snapshot_dir(pdir, n)
    if not src.is_dir():
        return False
    for f in src.rglob("*"):
        if f.is_file():
            target = pdir / f.relative_to(src)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, target)
    return True


def split_footer(text):
    """Pull Tweensy's footer lines ("Version label: …", "Suggestions: a | b") off the end of a reply."""
    label, suggestions, lines = "", [], text.rstrip().split("\n")
    while lines and re.match(r"\s*(version label|suggestions)\s*:", lines[-1], re.I):
        key, _, value = lines.pop().partition(":")
        if key.strip().lower() == "suggestions":
            suggestions = [s.strip(" .") for s in value.split("|") if s.strip(" .")][:4]
        else:
            label = value.strip(" .")
    return "\n".join(lines).rstrip(), label, suggestions


def fallback_label(prompt):
    words = re.sub(r"\[[^\]]*\]\s*", "", prompt).split()
    return " ".join(words[:6]).rstrip(".,:;") + ("…" if len(words) > 6 else "")


def record(pdir, state, n, prompt, label, t):
    """Save version n (its video was just rendered) into state and make it current."""
    info = probe(pdir / video_path(n))
    version = {"n": n, "file": video_path(n), "prompt": prompt, "label": label or fallback_label(prompt),
               "t": t, **info}
    snapshot(pdir, n)
    state.setdefault("versions", []).append(version)
    state["current"] = n
    return version


def find(state, n):
    return next((v for v in state.get("versions", []) if v["n"] == n), None)
