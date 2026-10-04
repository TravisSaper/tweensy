"""The local web server: serves the page, the guide, project files and the chat stream."""

import json
import mimetypes
import os
import re
import sys
import tempfile
import threading
import webbrowser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from . import __version__, assets, chat, config, projects, styles, system, versions
from .claude import write_runtime_files
from .export import clean_export
from .guide import SECTIONS

# Explicit types: Windows can map .js to text/plain in the registry, which breaks modules.
for ext, ctype in ((".mp4", "video/mp4"), (".m4v", "video/mp4"), (".mov", "video/quicktime"),
                   (".webm", "video/webm"), (".html", "text/html"), (".css", "text/css"),
                   (".js", "text/javascript")):
    mimetypes.add_type(ctype, ext)


class Handler(BaseHTTPRequestHandler):
    server_version = f"Tweensy/{__version__}"

    def log_message(self, fmt, *args):  # keep the terminal quiet
        pass

    # ---------- helpers ----------
    def send_json(self, obj, status=200):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length))
        except ValueError:
            return {}

    def save_body(self, dest):
        remaining = int(self.headers.get("Content-Length") or 0)
        with dest.open("wb") as fh:
            while remaining > 0:
                chunk = self.rfile.read(min(1 << 20, remaining))
                if not chunk:
                    break
                fh.write(chunk)
                remaining -= len(chunk)

    def send_file(self, path):
        size = path.stat().st_size
        ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        start, end = 0, size - 1
        rng = self.headers.get("Range")
        m = re.match(r"bytes=(\d*)-(\d*)", rng or "")
        if m and size:
            if m.group(1):
                start = int(m.group(1))
                if m.group(2):
                    end = min(int(m.group(2)), size - 1)
            elif m.group(2):
                start = max(size - int(m.group(2)), 0)
            if start > end:
                self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return
            self.send_response(HTTPStatus.PARTIAL_CONTENT)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        else:
            self.send_response(HTTPStatus.OK)
        length = end - start + 1 if size else 0
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        if self.command == "HEAD":
            return
        try:
            with path.open("rb") as fh:
                fh.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = fh.read(min(1 << 16, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def send_static(self, url_path):
        """Serve the page and its CSS/JS from the static folder, and nothing outside it."""
        static = config.STATIC.resolve()
        target = (static / unquote(url_path).lstrip("/")).resolve()
        if target.is_file() and static in target.parents:
            return self.send_file(target)
        return self.send_json({"error": "Not found"}, 404)

    # ---------- routes ----------
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        url = urlparse(self.path)
        parts = [unquote(p) for p in url.path.split("/") if p]

        if url.path in ("/", "/index.html"):
            return self.send_file(config.STATIC / "index.html")
        if url.path == "/api/guide":
            return self.send_json(SECTIONS)
        if url.path == "/api/status":
            return self.send_json(system.check_setup())
        if url.path == "/api/settings":
            return self.send_json({"port": config.PORT, "saved_port": config.saved_port()})
        if url.path == "/api/styles":
            return self.send_json(styles.load())
        if url.path == "/api/usage":
            return self.send_json(chat.load_usage())
        if url.path == "/api/assets":
            return self.send_json({"assets": assets.list_assets(), "folder": str(config.ASSETS)})
        if len(parts) == 2 and parts[0] == "assets":
            asset = assets.find(parts[1])
            return self.send_file(asset) if asset else self.send_json({"error": "Not found"}, 404)
        if url.path == "/api/projects":
            # ponytail: counts videos by walking every project; cache it if people have hundreds
            return self.send_json([{**p, "videos": len(projects.list_videos(config.PROJECTS / p["name"])),
                                    "busy": chat.is_running(p["name"])} for p in projects.list_projects()])

        # /api/projects/<name>/history|videos
        if len(parts) == 4 and parts[:2] == ["api", "projects"]:
            pdir = projects.project_dir(parts[2])
            if not pdir:
                return self.send_json({"error": "No such project"}, 404)
            if parts[3] == "history":
                state = projects.load_state(pdir)
                busy = chat.is_running(parts[2])
                return self.send_json({"history": state.get("history", []), "busy": busy, "path": str(pdir),
                                       "export": clean_export(state.get("export")),
                                       "progress": chat.PROGRESS.get(parts[2]) if busy else None})
            if parts[3] == "videos":
                return self.send_json(projects.list_videos(pdir))
            if parts[3] == "versions":
                state = projects.load_state(pdir)
                vs = [v for v in state.get("versions", []) if (pdir / v["file"]).is_file()]
                files = {v["file"] for v in vs}
                return self.send_json({"versions": vs[::-1], "current": state.get("current"),
                                       "others": [v for v in projects.list_videos(pdir) if v["path"] not in files]})

        # /files/<project>/<path...>
        if len(parts) >= 3 and parts[0] == "files":
            pdir = projects.project_dir(parts[1])
            if pdir:
                target = (pdir / "/".join(parts[2:])).resolve()
                if target.is_file() and pdir in target.parents:
                    return self.send_file(target)
            return self.send_json({"error": "Not found"}, 404)

        if parts and parts[0] != "api":
            return self.send_static(url.path)
        self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        url = urlparse(self.path)
        parts = [unquote(p) for p in url.path.split("/") if p]
        if url.path == "/api/projects":
            return self.send_json({"name": projects.create_project(self.read_json().get("name", ""))})
        if url.path == "/api/stop":
            return self.send_json({"stopped": chat.stop(self.read_json().get("project"))})
        if url.path == "/api/port":
            try:
                return self.send_json({"port": config.save_port(self.read_json().get("port"))})
            except (TypeError, ValueError):
                return self.send_json({"error": "Pick a port from 1024 to 65535."}, 400)
        if url.path == "/api/styles":
            try:
                return self.send_json(styles.save(self.read_json()))
            except ValueError as err:
                return self.send_json({"error": str(err)}, 400)
        if url.path == "/api/styles/delete":
            ok = styles.delete(self.read_json().get("id"))
            return self.send_json({"deleted": ok}, 200 if ok else 404)
        if url.path == "/api/assets/add":
            return self.handle_add_asset(self.read_json())
        if url.path == "/api/upload":
            return self.handle_upload(parse_qs(url.query))
        if len(parts) == 4 and parts[:2] == ["api", "projects"] and parts[3] == "export":
            return self.handle_export(parts[2])
        if len(parts) == 4 and parts[:2] == ["api", "projects"] and parts[3] == "open-folder":
            pdir = projects.project_dir(parts[2])
            if not pdir:
                return self.send_json({"error": "No such project"}, 404)
            try:
                system.open_folder(pdir)
            except OSError as err:
                return self.send_json({"error": f"Couldn't open the folder: {err}", "path": str(pdir)}, 500)
            return self.send_json({"opened": True})
        if len(parts) == 4 and parts[:2] == ["api", "projects"] and parts[3] == "restore":
            return self.handle_restore(parts[2], self.read_json())
        if url.path == "/api/chat":
            return self.handle_chat(self.read_json())
        self.send_json({"error": "Not found"}, 404)

    def handle_export(self, name):
        pdir = projects.project_dir(name)
        if not pdir:
            return self.send_json({"error": "No such project"}, 404)
        export = clean_export(self.read_json())
        state = projects.load_state(pdir)
        state["export"] = export
        projects.save_state(pdir, state)
        return self.send_json(export)

    def handle_upload(self, query):
        pdir = projects.project_dir((query.get("project") or [""])[0])
        fname = Path((query.get("name") or [""])[0]).name
        if not pdir or not fname or fname.startswith("."):
            return self.send_json({"error": "Bad upload"}, 400)
        dest_dir = folder_in(pdir, (query.get("folder") or [""])[0])
        if not dest_dir:
            return self.send_json({"error": "Bad folder"}, 400)
        # Save once into the shared Assets folder, then link it into the project.
        config.ASSETS.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=config.ASSETS, prefix=".upload-")
        os.close(fd)
        try:
            self.save_body(Path(tmp))
            asset, reused = assets.store(Path(tmp), fname)
        finally:
            Path(tmp).unlink(missing_ok=True)
        assets.place(asset, dest_dir / fname)
        return self.send_json({"saved": (dest_dir / fname).relative_to(pdir).as_posix(), "reused": reused})

    def handle_restore(self, name, data):
        pdir = projects.project_dir(name)
        if not pdir:
            return self.send_json({"error": "No such project"}, 404)
        if chat.is_running(name):
            return self.send_json({"error": "Claude is still working on this project."}, 409)
        state = projects.load_state(pdir)
        v = versions.find(state, data.get("n"))
        if not v or not versions.restore(pdir, v["n"]):
            return self.send_json({"error": "That version can't be restored."}, 400)
        state["current"] = state["restored"] = v["n"]
        projects.save_state(pdir, state)
        return self.send_json({"current": v["n"]})

    def handle_add_asset(self, data):
        pdir = projects.project_dir(data.get("project") or "")
        asset = assets.find(data.get("name"))
        dest_dir = folder_in(pdir, data.get("folder") or "") if pdir else None
        if not asset or not dest_dir:
            return self.send_json({"error": "Bad request"}, 400)
        assets.place(asset, dest_dir / asset.name)
        return self.send_json({"saved": (dest_dir / asset.name).relative_to(pdir).as_posix()})

    def handle_chat(self, data):
        name = data.get("project", "")
        message = (data.get("message") or "").strip()
        pdir = projects.project_dir(name)
        if not pdir or not message:
            return self.send_json({"error": "Pick a project and type a message."}, 400)
        try:
            turn = chat.start(name, pdir, message)
        except chat.ChatError as err:
            return self.send_json({"error": str(err)}, err.status)

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        alive = True
        lock = threading.Lock()

        def emit(obj):
            nonlocal alive
            with lock:
                if not alive:
                    return
                try:
                    self.wfile.write(f"data: {json.dumps(obj)}\n\n".encode())
                    self.wfile.flush()
                except OSError:
                    alive = False  # keep running so the reply is still saved

        turn.stream(emit)


def folder_in(pdir, sub):
    """The project folder or one plain sub-folder in it (made if missing), or None if the name is bad."""
    if not sub:
        return pdir
    if not re.fullmatch(r"[A-Za-z0-9_-]+", sub):
        return None
    (pdir / sub).mkdir(exist_ok=True)
    return pdir / sub


START_CMD = "tweensy" if config.FROZEN else "python3 app.py"


def main():
    if "--port" in sys.argv:  # `tweensy --port 9000` saves it as the new default
        try:
            config.PORT = config.save_port(sys.argv[sys.argv.index("--port") + 1])
        except (IndexError, ValueError):
            sys.exit(f"Usage: {START_CMD} --port 9000   (a number from 1024 to 65535)")
        print(f"  Saved: Tweensy will use port {config.PORT} from now on.")
    config.PROJECTS.mkdir(parents=True, exist_ok=True)
    write_runtime_files()
    url = f"http://localhost:{config.PORT}"
    try:
        server = ThreadingHTTPServer((config.HOST, config.PORT), Handler)
    except OSError:
        print(f"Port {config.PORT} is busy. Tweensy may already be running: {url}")
        print(f"  If something else uses that port, start Tweensy on another one: {START_CMD} --port 9000")
        webbrowser.open(url)
        sys.exit(1)
    server.daemon_threads = True
    print(f"\n  Tweensy is running at {url}")
    print(f"  Your projects are in {config.PROJECTS}")
    print("  Keep this window open while you use it. Close it (or press Ctrl+C) to stop.\n")
    if not system.find_claude():
        print("  Claude Code isn't installed yet. The page will show you how to set it up.\n")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopping...")
        chat.stop_all()
