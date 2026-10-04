"""HTTP tests for Tweensy's server. Standard library only; Claude Code is not needed.

    python -m unittest discover -s tests -v
"""

import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tweensy import __version__, chat, claude, config, projects, system, versions  # noqa: E402
from tweensy.guide import SECTIONS  # noqa: E402
from tweensy.server import Handler  # noqa: E402


class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        # Point every writable location at a temp dir so tests never touch real projects.
        config.PROJECTS = cls.tmp / "projects"
        config.STATE_DIR = config.PROJECTS / ".chats"
        config.RUNTIME = cls.tmp / ".runtime"
        config.DATA = cls.tmp
        config.SETTINGS = cls.tmp / "settings.json"
        config.ASSETS = cls.tmp / "assets"
        config.PROJECTS.mkdir()
        claude.write_runtime_files()
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.server.daemon_threads = True
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        shutil.rmtree(cls.tmp, ignore_errors=True)

    # ---------- helpers ----------
    def request(self, path, data=None, headers=None, method=None):
        req = urllib.request.Request(self.base + path, data=data, headers=headers or {}, method=method)
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                return res.status, res.headers, res.read()
        except urllib.error.HTTPError as err:
            with err:
                return err.code, err.headers, err.read()

    def get_json(self, path):
        status, _, body = self.request(path)
        return status, json.loads(body)

    def post_json(self, path, obj):
        status, _, body = self.request(path, json.dumps(obj).encode(), {"Content-Type": "application/json"})
        return status, json.loads(body)

    def make_project(self, name):
        status, body = self.post_json("/api/projects", {"name": name})
        self.assertEqual(status, 200)
        return body["name"]

    # ---------- tests ----------
    def test_index_page(self):
        status, headers, body = self.request("/")
        self.assertEqual(status, 200)
        self.assertIn("text/html", headers["Content-Type"])
        self.assertIn(b"Tweensy", body)

    def test_port_setting(self):
        self.assertIsNone(config.saved_port())
        for bad in ("abc", 80, 70000, None):
            status, body = self.post_json("/api/port", {"port": bad})
            self.assertEqual(status, 400, bad)
        status, body = self.post_json("/api/port", {"port": 9000})
        self.assertEqual((status, body["port"]), (200, 9000))
        self.assertEqual(config.saved_port(), 9000)
        self.assertEqual(self.get_json("/api/settings")[1]["saved_port"], 9000)

    def test_guide_has_every_prompt(self):
        status, guide = self.get_json("/api/guide")
        self.assertEqual(status, 200)
        ids = {i.get("id") for s in guide for i in s["items"]}
        # The UI looks these up by id (starters, the Set up my computer button).
        for needed in ("setup", "first-video", "moves-demo", "text-video", "product-video",
                       "app-promo", "own-video", "fix-moment", "sound", "transparent"):
            self.assertIn(needed, ids)
        styles = [i["label"] for s in guide for i in s["items"] if i["kind"] == "style"]
        self.assertEqual(styles, ["Bold Type", "Frosted Glass", "Paper Print", "Neon Pop"])

    def test_every_menu_section_exists(self):
        # The dock menus (guide.js) and the export badge pop-up (export.js) show these section ids.
        section_ids = {s["id"] for s in SECTIONS}
        for sid in ("start", "setup", "first", "make", "polish", "moves", "change", "styles", "export", "fix"):
            self.assertIn(sid, section_ids)
        js = Path(__file__).resolve().parents[1] / "static" / "js"
        menus = "".join((js / f).read_text(encoding="utf-8") for f in ("guide.js", "export.js"))
        for sid in section_ids:
            self.assertIn(f'"{sid}"', menus, f"section {sid} isn't in any menu")

    def test_page_assets_are_served(self):
        for path, ctype in (("/css/styles.css", "text/css"), ("/js/main.js", "text/javascript"),
                            ("/js/chat.js", "text/javascript"), ("/js/sketch.js", "text/javascript")):
            status, headers, body = self.request(path)
            self.assertEqual(status, 200, path)
            self.assertIn(ctype, headers["Content-Type"], path)
            self.assertTrue(body)
        for path in ("/js/../../app.py", "/..%2F..%2Fapp.py", "/js/missing.js"):
            status, _, body = self.request(path)
            self.assertEqual(status, 404, path)

    def test_guide_items_are_well_formed(self):
        for sec in SECTIONS:
            for key in ("id", "num", "title", "body", "items"):
                self.assertIn(key, sec)
            for item in sec["items"]:
                self.assertIn(item["kind"], {"prompt", "style", "tweak", "move"})
                self.assertTrue(item["label"] and item["text"])

    def test_status_reports_setup(self):
        status, s = self.get_json("/api/status")
        self.assertEqual(status, 200)
        for key in ("os", "claude", "logged_in", "node", "ffmpeg", "skills", "whisper", "ready", "version"):
            self.assertIn(key, s)
        self.assertIn(s["os"], {"mac", "windows", "linux"})
        self.assertEqual(s["version"], __version__)

    def test_create_project_slugifies_and_dedupes(self):
        first = self.make_project("My Cool Video!")
        second = self.make_project("My Cool Video!")
        self.assertEqual(first, "my-cool-video")
        self.assertEqual(second, "my-cool-video-2")
        status, projects = self.get_json("/api/projects")
        names = {p["name"] for p in projects}
        self.assertTrue({first, second} <= names)
        self.assertNotIn(".chats", names)
        # The project folder stays empty so `hyperframes init` can scaffold into it.
        self.assertEqual(list((config.PROJECTS / first).iterdir()), [])

    def test_history_starts_empty(self):
        name = self.make_project("history")
        status, data = self.get_json(f"/api/projects/{name}/history")
        self.assertEqual(status, 200)
        self.assertEqual(data["history"], [])
        self.assertFalse(data["busy"])
        self.assertEqual(data["export"], {"aspect": "16:9", "res": "4k", "fps": 60})

    def test_export_setting_saves_and_validates(self):
        name = self.make_project("export")
        status, saved = self.post_json(f"/api/projects/{name}/export", {"aspect": "1:1", "res": "1080p", "fps": 24})
        self.assertEqual(status, 200)
        self.assertEqual(saved, {"aspect": "1:1", "res": "1080p", "fps": 24})
        status, data = self.get_json(f"/api/projects/{name}/history")
        self.assertEqual(data["export"], {"aspect": "1:1", "res": "1080p", "fps": 24})
        # Anything unknown falls back to the default.
        status, saved = self.post_json(f"/api/projects/{name}/export", {"aspect": "21:9", "res": "8k", "fps": "999"})
        self.assertEqual(saved, {"aspect": "16:9", "res": "4k", "fps": 60})
        status, _ = self.post_json("/api/projects/no-such-project/export", {"res": "4k", "fps": 60})
        self.assertEqual(status, 404)

    def test_upload_and_video_listing_and_range(self):
        name = self.make_project("uploads")
        payload = bytes(range(256)) * 40
        status, _, body = self.request(f"/api/upload?project={name}&name=clip.mp4&folder=renders", payload, method="POST")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["saved"], "renders/clip.mp4")

        status, videos = self.get_json(f"/api/projects/{name}/videos")
        self.assertEqual([v["path"] for v in videos], ["renders/clip.mp4"])
        self.assertEqual(videos[0]["size"], len(payload))

        status, headers, body = self.request(f"/files/{name}/renders/clip.mp4", headers={"Range": "bytes=10-19"})
        self.assertEqual(status, 206)
        self.assertEqual(body, payload[10:20])
        self.assertEqual(headers["Content-Range"], f"bytes 10-19/{len(payload)}")
        self.assertEqual(headers["Content-Type"], "video/mp4")

    def test_video_prompt_and_project_counts(self):
        name = self.make_project("prompts")
        pdir = config.PROJECTS / name
        (pdir / "renders").mkdir()
        video = pdir / "renders" / "a.mp4"
        video.write_bytes(b"x")
        made = video.stat().st_mtime
        state = {"session_id": None, "history": [
            {"role": "user", "text": "first ask", "t": made - 60},
            {"role": "user", "text": "the one that made it", "t": made - 5},
            {"role": "user", "text": "asked afterwards", "t": made + 60},
        ]}
        projects.save_state(pdir, state)
        _, videos = self.get_json(f"/api/projects/{name}/videos")
        self.assertEqual(videos[0]["prompt"], "the one that made it")
        _, listed = self.get_json("/api/projects")
        row = next(p for p in listed if p["name"] == name)
        self.assertEqual((row["videos"], row["busy"]), (1, False))

    def test_uploads_share_one_copy(self):
        a, b, c = (self.make_project(n) for n in ("share-a", "share-b", "share-c"))
        logo = b"logo-bytes" * 500

        def upload(project, data, name="logo.png", folder=""):
            q = f"/api/upload?project={project}&name={name}&folder={folder}"
            status, _, body = self.request(q, data, method="POST")
            return status, json.loads(body)

        self.assertEqual(upload(a, logo), (200, {"saved": "logo.png", "reused": False}))
        self.assertEqual(upload(b, logo, folder="screenshots"), (200, {"saved": "screenshots/logo.png", "reused": True}))
        fa, fb = config.PROJECTS / a / "logo.png", config.PROJECTS / b / "screenshots" / "logo.png"
        self.assertEqual(fa.read_bytes(), logo)
        self.assertTrue(os.path.samefile(fa, fb))  # one file on disk, two names
        self.assertEqual([x.name for x in config.ASSETS.iterdir() if x.name.startswith("logo")], ["logo.png"])

        # Same name, different picture: kept separately.
        upload(a, b"another picture")
        _, listed = self.get_json("/api/assets")
        self.assertEqual(sorted(x["name"] for x in listed["assets"] if x["name"].startswith("logo")), ["logo-2.png", "logo.png"])
        self.assertEqual((config.PROJECTS / a / "logo.png").read_bytes(), b"another picture")
        self.assertEqual(fb.read_bytes(), logo)  # the other project's copy is untouched

        # Add from Your uploads, no new upload.
        status, body = self.post_json("/api/assets/add", {"project": c, "name": "logo.png", "folder": "fonts"})
        self.assertEqual((status, body["saved"]), (200, "fonts/logo.png"))
        self.assertTrue(os.path.samefile(fb, config.PROJECTS / c / "fonts" / "logo.png"))
        for bad in ({"project": c, "name": "../settings.json"}, {"project": c, "name": "logo.png", "folder": "../x"},
                    {"project": "nope", "name": "logo.png"}):
            self.assertEqual(self.post_json("/api/assets/add", bad)[0], 400, bad)
        self.assertEqual(self.request("/assets/logo.png")[0], 200)
        self.assertEqual(self.request("/assets/..%2Fsettings.json")[0], 404)

    def test_versions_record_list_and_restore(self):
        name = self.make_project("versioned")
        pdir = config.PROJECTS / name
        (pdir / "renders").mkdir()
        (pdir / "renders" / "storyboard.mp4").write_bytes(b"old render")  # existing, never touched
        (pdir / "renders" / "v002.mp4").write_bytes(b"made by hand")     # its number is skipped
        state = projects.load_state(pdir)
        self.assertEqual(versions.next_number(pdir, state), 3)

        (pdir / "index.html").write_text("<h1>first</h1>")
        (pdir / "renders" / "v003.mp4").write_bytes(b"v3")
        versions.record(pdir, state, 3, "Make a title card", "title card", 1.0)
        (pdir / "index.html").write_text("<h1>second</h1>")
        (pdir / "renders" / "v004.mp4").write_bytes(b"v4")
        versions.record(pdir, state, 4, "Make the pause longer after the reconnect", "", 2.0)
        projects.save_state(pdir, state)

        _, data = self.get_json(f"/api/projects/{name}/versions")
        self.assertEqual([v["n"] for v in data["versions"]], [4, 3])
        self.assertEqual(data["current"], 4)
        self.assertEqual(data["versions"][0]["label"], "Make the pause longer after the…")
        self.assertEqual(sorted(o["path"] for o in data["others"]), ["renders/storyboard.mp4", "renders/v002.mp4"])

        status, body = self.post_json(f"/api/projects/{name}/restore", {"n": 3})
        self.assertEqual((status, body), (200, {"current": 3}))
        self.assertEqual((pdir / "index.html").read_text(), "<h1>first</h1>")
        self.assertEqual((pdir / "renders" / "storyboard.mp4").read_bytes(), b"old render")
        self.assertEqual(projects.load_state(pdir)["restored"], 3)
        self.assertEqual(self.post_json(f"/api/projects/{name}/restore", {"n": 99})[0], 400)

    def test_upload_rejects_bad_names(self):
        name = self.make_project("badnames")
        for query in (f"project={name}&name=.hidden", f"project={name}&name=x.png&folder=../up",
                      "project=../etc&name=x.png", f"project={name}&name="):
            status, _, _ = self.request(f"/api/upload?{query}", b"x", method="POST")
            self.assertEqual(status, 400, query)

    def test_files_cannot_escape_project(self):
        name = self.make_project("escape")
        (config.PROJECTS / "secret.txt").write_text("nope")
        for path in (f"/files/{name}/../secret.txt", f"/files/{name}/..%2Fsecret.txt", "/files/..%2F/secret.txt"):
            status, _, body = self.request(path)
            self.assertEqual(status, 404, path)
            self.assertNotIn(b"nope", body)

    def test_turn_keeps_narration_out_of_the_reply_and_records_a_version(self):
        name = self.make_project("narrated")
        pdir = config.PROJECTS / name
        fake = self.tmp / "fake_claude.py"
        lines = [
            {"type": "assistant", "message": {"content": [{"type": "text", "text": "Checking the composition."}]}},
            {"type": "assistant", "message": {"content": [{"type": "tool_use", "name": "Bash", "input": {"command": "npx hyperframes lint"}}]}},
            {"type": "assistant", "message": {"content": [{"type": "text", "text": "The checker keeps flagging a warning."}]}},
            {"type": "assistant", "message": {"content": [{"type": "tool_use", "name": "Bash", "input": {"command": "npx hyperframes render ."}}]}},
            {"type": "assistant", "message": {"content": [{"type": "text", "text":
                "Made the pause longer. Now 12 s at 1080p, 24 fps.\nVersion label: longer pause\nSuggestions: Make it faster | Try Neon Pop"}]}},
            {"type": "rate_limit_event", "rate_limit_info": {"status": "allowed", "rateLimitType": "five_hour", "resetsAt": 1,
                                                            "unifiedWindows": {"seven_day": {"utilization": 0.53, "resetsAt": 2}}}},
            {"type": "result", "result": "done", "is_error": False},
        ]
        fake.write_text("import json, pathlib, sys\nsys.stdin.read()\n"
                        "pathlib.Path('renders').mkdir(exist_ok=True)\npathlib.Path('renders/v001.mp4').write_bytes(b'video')\n"
                        + "".join(f"print(json.dumps({line!r}))\n" for line in lines))
        real_find, real_build = system.find_claude, claude.build_command
        system.find_claude = lambda: "fake"
        claude.build_command = lambda exe, sid, new: [sys.executable, str(fake)]
        try:
            events = []
            chat.start(name, pdir, "Make the pause longer").stream(events.append)
        finally:
            system.find_claude, claude.build_command = real_find, real_build
        reply = projects.load_state(pdir)["history"][-1]
        self.assertEqual(reply["text"], "Made the pause longer. Now 12 s at 1080p, 24 fps.")
        self.assertIn("“The checker keeps flagging a warning.”", reply["steps"])
        self.assertIn("“Checking the composition.”", reply["steps"])
        self.assertEqual(reply["suggestions"], ["Make it faster", "Try Neon Pop"])
        self.assertEqual((reply["version"], reply["video"]), (1, "renders/v001.mp4"))
        v = projects.load_state(pdir)["versions"][0]
        self.assertEqual((v["label"], v["prompt"]), ("longer pause", "Make the pause longer"))
        self.assertEqual(events[-1]["kind"], "done")
        usage = self.get_json("/api/usage")[1]
        self.assertEqual((usage["rateLimitType"], usage["unifiedWindows"]["seven_day"]["utilization"]), ("five_hour", 0.53))

    def test_your_styles(self):
        self.assertEqual(self.get_json("/api/styles"), (200, []))
        status, made = self.post_json("/api/styles", {"label": "Sunset Grain", "note": "Warm film look",
                                                       "text": "- Font: Fraunces\n- Colours: amber and plum"})
        self.assertEqual((status, made["id"]), (200, "my-sunset-grain"))
        self.assertTrue(made["text"].startswith("STYLE: Sunset Grain\n- Font: Fraunces"))
        # Same name again gets its own id; editing by id keeps it.
        self.assertEqual(self.post_json("/api/styles", {"label": "Sunset Grain", "text": "x"})[1]["id"], "my-sunset-grain-2")
        status, edited = self.post_json("/api/styles", {"id": "my-sunset-grain", "label": "Sunset Grain II",
                                                         "text": "STYLE: old name\n- Motion: slow"})
        self.assertEqual(edited["text"], "STYLE: Sunset Grain II\n- Motion: slow")
        self.assertEqual([s["id"] for s in self.get_json("/api/styles")[1]], ["my-sunset-grain", "my-sunset-grain-2"])
        for bad in ({"label": "", "text": "x"}, {"label": "x" * 41, "text": "x"}, {"label": "ok", "text": ""}):
            self.assertEqual(self.post_json("/api/styles", bad)[0], 400, bad)
        self.assertEqual(self.post_json("/api/styles/delete", {"id": "my-sunset-grain-2"}), (200, {"deleted": True}))
        self.assertEqual(self.post_json("/api/styles/delete", {"id": "nope"})[0], 404)
        self.assertEqual(len(self.get_json("/api/styles")[1]), 1)

    def test_open_folder(self):
        name = self.make_project("openme")
        opened, real = [], system.open_folder
        system.open_folder = opened.append
        try:
            self.assertEqual(self.post_json(f"/api/projects/{name}/open-folder", {}), (200, {"opened": True}))
            self.assertEqual(self.post_json("/api/projects/nope/open-folder", {})[0], 404)
        finally:
            system.open_folder = real
        self.assertEqual(opened, [projects.project_dir(name)])  # resolved, like the app (macOS /private, Windows long names)

    def test_chat_needs_project_and_message(self):
        status, body = self.post_json("/api/chat", {"project": "", "message": "hi"})
        self.assertEqual(status, 400)
        name = self.make_project("chat")
        status, body = self.post_json("/api/chat", {"project": name, "message": "   "})
        self.assertEqual(status, 400)

    def test_stop_when_idle(self):
        status, body = self.post_json("/api/stop", {"project": "nothing-running"})
        self.assertEqual(status, 200)
        self.assertFalse(body["stopped"])

    def test_runtime_files(self):
        settings = json.loads((config.RUNTIME / "settings.json").read_text(encoding="utf-8"))
        allow = settings["permissions"]["allow"]
        self.assertIn("Bash(npx:*)", allow)
        self.assertNotIn("Bash(rm:*)", allow)
        self.assertNotIn("Bash(sudo:*)", allow)
        self.assertTrue(settings["disableAllHooks"])
        self.assertIn("Tweensy", (config.RUNTIME / "system_note.txt").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
