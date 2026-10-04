"""Finding installed tools, checking setup, and controlling the Claude Code process."""

import json
import os
import platform
import re
import shutil
import signal
import subprocess
from pathlib import Path

from . import __version__, config


def find_claude():
    found = shutil.which("claude")
    if found:
        return found
    home = Path.home()
    candidates = [home / ".local/bin/claude", home / ".claude/local/claude",
                  Path("/usr/local/bin/claude"), Path("/opt/homebrew/bin/claude")]
    if config.IS_WINDOWS:
        appdata = Path(os.environ.get("APPDATA", home / "AppData/Roaming"))
        candidates = [home / ".local/bin/claude.exe", home / ".claude/local/claude.exe",
                      appdata / "npm/claude.cmd"]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return None


def child_env():
    """Environment for programs Tweensy starts. A frozen (downloaded) app on Linux points
    LD_LIBRARY_PATH at its own bundled libraries; give children the original back so
    Claude Code, Node and FFmpeg load the system's libraries."""
    env = dict(os.environ)
    if config.FROZEN and "LD_LIBRARY_PATH" in env:
        orig = env.pop("LD_LIBRARY_PATH_ORIG", None)
        if orig:
            env["LD_LIBRARY_PATH"] = orig
        else:
            del env["LD_LIBRARY_PATH"]
    return env


def run_quiet(cmd, timeout=20):
    """Run a short command and return (returncode, stdout); never raises."""
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                             errors="replace", timeout=timeout, stdin=subprocess.DEVNULL,
                             env=child_env())
        return res.returncode, res.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return None, ""


def check_setup():
    """Everything the setup screen shows. Re-run on demand, so installs show up."""
    claude = find_claude()
    out = {"os": config.OS_NAME, "claude": bool(claude), "claude_version": None, "logged_in": False,
           "plan": None, "node": False, "node_version": None, "ffmpeg": False,
           "skills": (Path.home() / ".claude/skills/hyperframes").is_dir(),
           "whisper": bool(shutil.which("whisper-cli") or shutil.which("whisper-cpp")),
           "python": platform.python_version(),
           "version": __version__}
    if claude:
        _, ver = run_quiet([claude, "--version"])
        out["claude_version"] = ver.split()[0] if ver else None
        code, raw = run_quiet([claude, "auth", "status", "--json"])
        try:
            auth = json.loads(raw)
            out["logged_in"] = bool(auth.get("loggedIn"))
            out["plan"] = auth.get("subscriptionType") or auth.get("authMethod")
        except ValueError:
            out["logged_in"] = code == 0
    node = shutil.which("node")
    if node:
        _, ver = run_quiet([node, "--version"])
        out["node_version"] = ver
        m = re.match(r"v(\d+)", ver or "")
        out["node"] = bool(m and int(m.group(1)) >= 22)
    out["ffmpeg"] = bool(shutil.which("ffmpeg"))
    out["ready"] = all(out[k] for k in ("claude", "logged_in", "node", "ffmpeg"))
    return out


def popen_group_kwargs():
    """Start Claude in its own process group so Stop can end everything it started."""
    if config.IS_WINDOWS:
        return {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
    return {"start_new_session": True}


def open_folder(path):
    """Show a folder in Finder, Explorer or the desktop's file manager."""
    if config.IS_WINDOWS:
        os.startfile(path)  # noqa: S606 (a local folder the app owns)
    else:
        cmd = "open" if config.OS_NAME == "mac" else "xdg-open"
        subprocess.Popen([cmd, str(path)], env=child_env(), stdin=subprocess.DEVNULL,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)


def kill_tree(proc):
    if config.IS_WINDOWS:
        run_quiet(["taskkill", "/F", "/T", "/PID", str(proc.pid)])
        return
    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except (ProcessLookupError, PermissionError):
        proc.terminate()
