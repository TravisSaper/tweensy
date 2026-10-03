"""HTTP tests for Tweensy's server. Standard library only; Claude Code is not needed.

    python -m unittest discover -s tests -v
"""

import json
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

from tweensy import __version__, claude, config  # noqa: E402
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
        # The bottom-nav menus in static/index.html group these section ids.
        section_ids = {s["id"] for s in SECTIONS}
        for sid in ("start", "setup", "first", "make", "polish", "moves", "change", "styles", "export", "fix"):
            self.assertIn(sid, section_ids)
        menus = (Path(__file__).resolve().parents[1] / "static" / "js" / "guide.js").read_text(encoding="utf-8")
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
