"""Paths, network settings and platform facts shared by the rest of the app.

Other modules read these as attributes (config.PROJECTS, not a copied value) so tests can
point them at a temporary folder.
"""

import os
import platform
import sys
from pathlib import Path

HOST = "127.0.0.1"
PORT = int(os.environ.get("TWEENSY_PORT", "8765"))

# The downloadable apps are frozen with PyInstaller: the page ships inside the app, and
# your work goes in a Tweensy folder in your home folder. From source, both sit next to app.py.
FROZEN = getattr(sys, "frozen", False)
ROOT = Path(__file__).resolve().parent.parent
STATIC = (Path(sys._MEIPASS) if FROZEN else ROOT) / "static"
DATA = Path.home() / "Tweensy" if FROZEN else ROOT
PROJECTS = DATA / "projects"
STATE_DIR = PROJECTS / ".chats"  # chat history lives outside the project folders
RUNTIME = DATA / ".runtime"      # generated settings for Claude Code

IS_WINDOWS = os.name == "nt"
OS_NAME = {"Darwin": "mac", "Windows": "windows"}.get(platform.system(), "linux")
