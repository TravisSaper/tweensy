"""How Tweensy drives Claude Code: what it may do, what it's told, and how its
activity is described to the person using the app."""

import json
import re
from pathlib import Path

from . import config

# What Claude Code may do without asking. Headless mode can't show permission prompts,
# so anything not listed here is refused and Claude works around it or tells you.
ALLOWED_TOOLS = [
    "Read", "Write", "Edit", "Glob", "Grep", "Skill", "WebFetch", "WebSearch", "TodoWrite",
    "Bash(npx:*)", "Bash(npm:*)", "Bash(node:*)", "Bash(ffmpeg:*)", "Bash(ffprobe:*)",
    "Bash(whisper-cli:*)", "Bash(ls:*)", "Bash(cd:*)", "Bash(mkdir:*)", "Bash(cp:*)",
    "Bash(mv:*)", "Bash(cat:*)", "Bash(head:*)", "Bash(tail:*)", "Bash(find:*)",
    "Bash(file:*)", "Bash(curl:*)", "Bash(tar:*)", "Bash(unzip:*)", "Bash(echo:*)",
    "Bash(test:*)", "Bash(wc:*)", "Bash(grep:*)", "Bash(sed:*)", "Bash(python3:*)",
    "Bash(python:*)", "Bash(py:*)", "Bash(which:*)", "Bash(where:*)", "Bash(command:*)",
    "Bash(uname:*)", "Bash(sw_vers:*)", "Bash(tee:*)",
    # used by the "Set up this computer" prompt to install Node, FFmpeg and whisper-cpp
    "Bash(brew:*)", "Bash(winget:*)", "Bash(powershell:*)", "Bash(pwsh:*)", "Bash(setx:*)",
]

SYSTEM_NOTE = """You are talking to someone through Tweensy, a simple local web page, not a terminal.
They may not know code. Keep replies short, friendly and in plain words. Never ask them to type in a terminal
unless something truly needs their password or admin rights; then give the exact command, say it needs
their password, and tell them to come back and say "done".
You are working inside one project folder: make and render HyperFrames videos here, with renders going in
renders/. Use the HyperFrames skills (start with /hyperframes). The user asked for the render when they ask
for a video, so render without asking "preview first, or render?".
Quality bar: aim for polished, premium motion design. Use deliberate easing, layered depth (soft shadows,
gentle glow or parallax), crisp readable text, consistent spacing, and nothing cut off or overlapping.
After every render, look at a few frames from the finished file and fix anything that looks off before you
reply.
Each message ends with the user's export setting from the app. Follow it for every render unless the message
itself asks for a different format, size or frame rate.
Text in [square brackets] in a prompt is a placeholder the user may have left in; use it as written.
If the message points at sketch images in sketches/ (a storyboard, one image per scene), open each one with the
Read tool before planning: black is the layout, red arrows are motion (numbers give the order), blue text labels
things. Only if a scene is genuinely unclear, ask short numbered questions and wait for answers instead of
guessing; otherwise build.
Files the person added (their photos, logos, fonts, sounds, videos) may be shared with their other projects, so
never edit or overwrite them in place: save any changed version under a new file name.
If a prompt points at a font file in fonts/ that is missing, download that free font (Google Fonts or the
@fontsource npm packages) into fonts/ yourself. If sounds are wanted and sfx/ is missing, make small
click/tick/chime sounds with ffmpeg into sfx/.
Run renders in the foreground and wait for them to finish before you reply: never use run_in_background or
"&" for a render. When this reply ends, anything still running is stopped, so a background render never
finishes. Give the Bash call the longest timeout (600000 ms). Tweensy shows its own progress bar.
When a render finishes, say the file name (for example renders/first.mp4): it appears in the Creations panel.
If you install something that needs a new PATH (Windows especially), tell them to close and reopen Tweensy."""


def write_runtime_files():
    """Claude's instructions and tool allowlist go in files, so no prompt text has to
    survive command-line quoting (which differs on Windows)."""
    config.RUNTIME.mkdir(exist_ok=True)
    (config.RUNTIME / "system_note.txt").write_text(SYSTEM_NOTE, encoding="utf-8")
    # Hooks from the person's own Claude Code setup (and its plugins) are meant for their
    # terminal sessions; inside Tweensy they only add noise, so runs start without them.
    settings = {"disableAllHooks": True, "permissions": {"allow": ALLOWED_TOOLS}}
    (config.RUNTIME / "settings.json").write_text(json.dumps(settings, indent=1), encoding="utf-8")


def build_command(claude, session_id, new_session):
    # The message goes in on stdin and everything else comes from files, so nothing
    # depends on how the operating system quotes command-line arguments.
    cmd = [claude, "-p", "--output-format", "stream-json", "--verbose",
           "--include-partial-messages", "--permission-mode", "acceptEdits",
           "--settings", str(config.RUNTIME / "settings.json"),
           "--append-system-prompt-file", str(config.RUNTIME / "system_note.txt")]
    return cmd + (["--session-id", session_id] if new_session else ["--resume", session_id])


def describe_tool(name, inp):
    """Turn a tool call into a short plain-English line for the activity feed."""
    inp = inp or {}
    if name in ("Bash", "PowerShell"):
        desc = inp.get("description") or inp.get("command", "")
        return desc[:140]
    if name in ("Write", "Edit", "MultiEdit"):
        return f"Editing {Path(inp.get('file_path', '')).name}"
    if name == "Read":
        return f"Looking at {Path(inp.get('file_path', '')).name}"
    if name in ("Glob", "Grep"):
        return "Searching the project"
    if name == "Skill":
        return f"Using the {inp.get('skill', '')} skill"
    if name in ("WebFetch", "WebSearch"):
        return "Looking something up online"
    if name == "TodoWrite":
        return None
    if name in ("Agent", "Task"):
        return f"Working on: {inp.get('description', 'a sub-task')}"
    return name


def friendly_error(text):
    """Turn Claude Code's error result into something a non-coder can act on."""
    if re.search(r"(session|usage|rate) limit|limit reached|hit your .*limit", text, re.I):
        reset = re.search(r"resets? ([^.\n]+)", text, re.I)
        when = f" It resets {reset.group(1).strip()}." if reset else ""
        return ("**Your Claude plan's usage limit was reached**, so Claude stopped partway." + when +
                " Your work so far is saved. When the limit resets, open this project and say **continue**.")
    return text


def failure_message(stderr_text):
    """What to show when Claude Code exits with an error and no reply."""
    if re.search(r"log ?in|/login|not logged|authenticat|api key", stderr_text, re.I):
        return ("Claude Code isn't signed in. Open **Setup** at the top of the page "
                "and follow the sign-in step, then try again.")
    return "Something went wrong:\n\n```\n" + stderr_text[-1500:] + "\n```"
