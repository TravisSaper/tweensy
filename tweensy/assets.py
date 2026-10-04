"""One shared copy of every uploaded file, hard-linked into the projects that use it.

A hard link is a second name for the same file on disk: it takes no extra space and every tool sees
an ordinary file. Uploading the same logo into ten projects keeps one copy. If linking isn't possible
(another drive, an odd file system), the file is copied instead.
"""

import hashlib
import os
import shutil
from pathlib import Path

from . import config

KINDS = {
    "image": {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"},
    "font": {".ttf", ".otf", ".woff", ".woff2"},
    "audio": {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"},
    "video": {".mp4", ".mov", ".webm", ".m4v", ".mkv"},
}


def kind(name):
    ext = Path(name).suffix.lower()
    return next((k for k, exts in KINDS.items() if ext in exts), "other")


def _sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _free_name(name):
    target = config.ASSETS / name
    stem, ext, n = target.stem, target.suffix, 2
    while target.exists():
        target = config.ASSETS / f"{stem}-{n}{ext}"
        n += 1
    return target


def store(tmp, name):
    """Keep an uploaded temp file in the Assets folder. Returns (asset path, reused?)."""
    size = tmp.stat().st_size
    digest = None
    # ponytail: hashes same-size files on every upload; add an index if the folder gets huge
    for f in config.ASSETS.iterdir():
        if f.is_file() and f != tmp and not f.name.startswith(".") and f.stat().st_size == size:
            digest = digest or _sha256(tmp)
            if _sha256(f) == digest:
                tmp.unlink()
                return f, True
    target = _free_name(name)
    tmp.replace(target)
    return target, False


def place(asset, dest):
    """Put an asset into a project folder without a second copy on disk."""
    if dest.exists():
        if os.path.samefile(asset, dest):
            return
        dest.unlink()  # replace the name; never write through a link into a shared file
    try:
        os.link(asset, dest)
    except OSError:
        shutil.copy2(asset, dest)


def find(name):
    """An asset by its plain file name, or None."""
    base = Path(name or "").name
    path = config.ASSETS / base
    return path if base and not base.startswith(".") and path.is_file() else None


def list_assets():
    config.ASSETS.mkdir(parents=True, exist_ok=True)
    items = [{"name": f.name, "size": st.st_size, "mtime": st.st_mtime, "kind": kind(f.name)}
             for f in config.ASSETS.iterdir() if f.is_file() and not f.name.startswith(".")
             for st in [f.stat()]]
    return sorted(items, key=lambda x: -x["mtime"])
