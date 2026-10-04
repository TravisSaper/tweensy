"""Running one chat turn: start Claude Code in the project, stream what it does, save the reply."""

import json
import subprocess
import threading
import time
import uuid

from . import claude, config, progress, system, versions
from .export import clean_export, render_note
from .projects import load_state, save_state

# project name -> running Popen, so the Stop button can end it
RUNNING = {}
STOPPED = set()
RUNNING_LOCK = threading.Lock()
PROGRESS = {}  # project name -> latest render progress, for pages reopened mid-run


class ChatError(Exception):
    def __init__(self, message, status):
        super().__init__(message)
        self.status = status


def is_running(name):
    with RUNNING_LOCK:
        return name in RUNNING


def stop(name):
    with RUNNING_LOCK:
        proc = RUNNING.get(name)
        if proc:
            STOPPED.add(name)
    if proc:
        system.kill_tree(proc)
    return bool(proc)


def stop_all():
    with RUNNING_LOCK:
        for proc in RUNNING.values():
            system.kill_tree(proc)


def usage_path():
    return config.RUNTIME / "usage.json"


def save_usage(info):
    """Keep the plan usage Claude Code reports with each reply, for the usage card."""
    try:
        config.RUNTIME.mkdir(parents=True, exist_ok=True)
        usage_path().write_text(json.dumps({**info, "seen": time.time()}), encoding="utf-8")
    except OSError:
        pass


def load_usage():
    try:
        return json.loads(usage_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def start(name, pdir, message):
    """Start Claude Code on `message`. Raises ChatError if it can't start."""
    exe = system.find_claude()
    if not exe:
        raise ChatError("Claude Code isn't installed yet. Open Setup at the top of the page.", 500)
    if is_running(name):
        raise ChatError("Claude is still working on this project.", 409)
    return Turn(name, pdir, message, exe)


class Turn:
    def __init__(self, name, pdir, message, exe):
        self.name, self.pdir, self.message = name, pdir, message
        self.t0 = time.time()
        self.state = load_state(pdir)
        self.new_session = not self.state.get("session_id")
        if self.new_session:
            self.state["session_id"] = str(uuid.uuid4())
        self.state.setdefault("history", []).append({"role": "user", "text": message, "t": time.time()})
        save_state(pdir, self.state)
        self.reply = {"role": "assistant", "text": "", "steps": [], "t": time.time()}
        self.version = versions.next_number(pdir, self.state)
        note = render_note(clean_export(self.state.get("export")), versions.video_path(self.version))
        restored = self.state.pop("restored", None)
        if restored:
            note += (f"\nThe user restored version v{restored} in Tweensy: the project files are back to how they "
                     "were for that version. Build on them.")
            save_state(pdir, self.state)

        cmd = claude.build_command(exe, self.state["session_id"], self.new_session)
        try:
            self.proc = subprocess.Popen(cmd, cwd=pdir, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                         stderr=subprocess.PIPE, text=True, encoding="utf-8",
                                         errors="replace", bufsize=1, env=system.child_env(),
                                         **system.popen_group_kwargs())
        except OSError as exc:
            raise ChatError(f"Couldn't start Claude Code: {exc}", 500) from exc
        with RUNNING_LOCK:
            RUNNING[name] = self.proc
            STOPPED.discard(name)
        try:
            self.proc.stdin.write(message + note)
            self.proc.stdin.close()
        except OSError:
            pass
        self.stderr_lines = []
        threading.Thread(target=lambda: self.stderr_lines.extend(self.proc.stderr), daemon=True).start()

    def stream(self, emit):
        """Read Claude's output until it exits, calling emit() with events for the page."""
        started = time.time()
        reply = self.reply

        def on_progress(info):
            PROGRESS[self.name] = info
            emit(info)

        threading.Thread(target=progress.watch, daemon=True,
                         args=(self.proc, self.pdir / progress.PROGRESS_LOG, started, on_progress)).start()

        def add_text(text):
            reply["text"] += text
            emit({"kind": "text", "text": text})

        emit({"kind": "status", "text": "Claude is thinking..."})
        blocks = []  # ("text", words) and ("tool", step) in the order Claude produced them
        streamed = False
        result_text, is_error = None, False
        try:
            for line in self.proc.stdout:
                try:
                    ev = json.loads(line)
                except ValueError:
                    continue
                etype = ev.get("type")
                if etype == "stream_event":
                    inner = ev.get("event", {})
                    if inner.get("type") == "message_start" and reply["text"] and not reply["text"].endswith("\n\n"):
                        add_text("\n\n")
                    delta = inner.get("delta", {})
                    if inner.get("type") == "content_block_delta" and delta.get("type") == "text_delta":
                        streamed = True
                        add_text(delta["text"])
                elif etype == "assistant":
                    for block in ev.get("message", {}).get("content", []):
                        if block.get("type") == "text" and block.get("text", "").strip():
                            blocks.append(("text", block["text"].strip()))
                        elif block.get("type") == "tool_use":
                            blocks.append(("tool", None))
                            step = claude.describe_tool(block.get("name"), block.get("input"))
                            if step:
                                blocks[-1] = ("tool", step)
                                reply["steps"].append(step)
                                emit({"kind": "step", "text": step})
                elif etype == "rate_limit_event":
                    save_usage(ev.get("rate_limit_info") or {})
                elif etype == "result":
                    result_text = ev.get("result")
                    is_error = bool(ev.get("is_error"))
        finally:
            self.proc.wait()
            with RUNNING_LOCK:
                RUNNING.pop(self.name, None)
                was_stopped = self.name in STOPPED
                STOPPED.discard(self.name)
            PROGRESS.pop(self.name, None)

        if not streamed and result_text and not is_error:
            add_text(result_text)
        if is_error and result_text and result_text.strip() not in reply["text"]:
            add_text(("\n\n" if reply["text"] else "") + claude.friendly_error(result_text.strip()))
        if was_stopped:
            add_text("Stopped." if not reply["text"] else "\n\n(Stopped.)")
        elif self.proc.returncode != 0 and not reply["text"]:
            err = "".join(self.stderr_lines[-15:]).strip() or f"Claude Code exited with code {self.proc.returncode}."
            add_text(claude.failure_message(err))
            is_error = True
            if not self.new_session and "No conversation found" in err:
                self.state["session_id"] = None  # start fresh next time

        # What Claude said between tool calls is progress narration: it goes in the folded step list.
        # The visible reply is only what it said after its last tool call.
        last_tool = max((i for i, (k, _) in enumerate(blocks) if k == "tool"), default=-1)
        final = "\n\n".join(t for k, t in blocks[last_tool + 1:] if k == "text")
        if last_tool >= 0 and final:
            reply["steps"] = [t if k == "tool" else f"“{t}”" for k, t in blocks[:last_tool + 1] if t]
            extra = reply["text"][reply["text"].rfind(final) + len(final):] if final in reply["text"] else ""
            reply["text"] = final + extra  # keep notes Tweensy added after it, like "(Stopped.)"

        state = load_state(self.pdir) | {"session_id": self.state["session_id"]}
        reply["error"] = is_error
        reply["text"], label, reply["suggestions"] = versions.split_footer(reply["text"])
        out = self.pdir / versions.video_path(self.version)
        if out.is_file() and out.stat().st_mtime >= self.t0 - 1:
            v = versions.record(self.pdir, state, self.version, self.message, label, time.time())
            reply["version"], reply["video"] = v["n"], v["file"]
        state.setdefault("history", []).append(reply)
        save_state(self.pdir, state)
        emit({"kind": "done", "error": is_error, "seconds": round(time.time() - started),
              "text": reply["text"], "version": reply.get("version"), "suggestions": reply["suggestions"]})
