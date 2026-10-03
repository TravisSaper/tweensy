"""Paths, network settings and platform facts shared by the rest of the app.

Other modules read these as attributes (config.PROJECTS, not a copied value) so tests can
point them at a temporary folder.
"""

import json
import os
import platform
import sys
from pathlib import Path

# The downloadable apps are frozen with PyInstaller: the page ships inside the app, and
# your work goes in a Tweensy folder in your home folder. From source, both sit next to app.py.
FROZEN = getattr(sys, "frozen", False)
ROOT = Path(__file__).resolve().parent.parent
STATIC = (Path(sys._MEIPASS) if FROZEN else ROOT) / "static"
DATA = Path.home() / "Tweensy" if FROZEN else ROOT
PROJECTS = DATA / "projects"
STATE_DIR = PROJECTS / ".chats"  # chat history lives outside the project folders
RUNTIME = DATA / ".runtime"      # generated settings for Claude Code
SETTINGS = DATA / "settings.json"  # choices you saved, like {"port": 9000}


def saved_port():
    try:
        return int(json.loads(SETTINGS.read_text())["port"])
    except (OSError, ValueError, KeyError, TypeError):
        return None


def save_port(port):
    port = int(port)
    if not 1024 <= port <= 65535:
        raise ValueError("Pick a port from 1024 to 65535.")
    DATA.mkdir(parents=True, exist_ok=True)
    SETTINGS.write_text(json.dumps({"port": port}) + "\n")
    return port


# Which port to serve on: TWEENSY_PORT for one run, else the saved one, else 8765.
HOST = "127.0.0.1"
PORT = int(os.environ.get("TWEENSY_PORT") or saved_port() or 8765)

IS_WINDOWS = os.name == "nt"
OS_NAME = {"Darwin": "mac", "Windows": "windows"}.get(platform.system(), "linux")
