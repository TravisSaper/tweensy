"""Unit tests for Tweensy's helpers: no server, no Claude Code."""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tweensy.claude import describe_tool, failure_message, friendly_error  # noqa: E402
from tweensy.export import clean_export, render_note  # noqa: E402
from tweensy.progress import read_render_progress  # noqa: E402
from tweensy.projects import slugify  # noqa: E402


class HelperTest(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Product Promo #2 "), "product-promo-2")
        self.assertEqual(slugify("!!!"), "project")
        self.assertLessEqual(len(slugify("x" * 100)), 48)

    def test_render_note(self):
        note_4k = render_note({"res": "4k", "fps": 60})
        self.assertIn("4K at 60 fps", note_4k)
        self.assertIn("--quality high --crf 12 --fps 60", note_4k)
        self.assertIn("landscape-4k", note_4k)
        note_hd = render_note({"res": "1080p", "fps": 30})
        self.assertIn("1080p at 30 fps", note_hd)
        self.assertIn("--fps 30", note_hd)
        self.assertNotIn("landscape-4k", note_hd)

    def test_read_render_progress(self):
        with tempfile.TemporaryDirectory() as tmp:
            log = Path(tmp) / "render.log"
            log.write_text(
                "\x1b[?25l  \u2588\u2591\u2591  25%  Starting frame capture\n"
                '[INFO] [Render:trace] {"phase":"capture","framesCompleted":12,"note":"99%  not a bar"}\n'
                "  \u2588\u2588\u2591  55%  Streaming frame 97/180 (6 workers)\r", encoding="utf-8")
            self.assertEqual(read_render_progress(log, 0), (55, "Streaming frame 97/180 (6 workers)"))
            # A log left over from an earlier run is ignored.
            self.assertIsNone(read_render_progress(log, log.stat().st_mtime + 10))
            self.assertIsNone(read_render_progress(Path(tmp) / "missing.log", 0))

    def test_friendly_error(self):
        msg = friendly_error("You've hit your session limit · resets 11:20pm (Asia/Singapore)")
        self.assertIn("usage limit", msg)
        self.assertIn("11:20pm (Asia/Singapore)", msg)
        self.assertIn("continue", msg)
        self.assertEqual(friendly_error("Something else broke"), "Something else broke")

    def test_render_note_writes_progress_log(self):
        self.assertIn("| tee .tweensy/render.log", render_note({"res": "1080p", "fps": 30}))

    def test_describe_tool(self):
        self.assertEqual(describe_tool("Bash", {"description": "Render the video"}), "Render the video")
        self.assertEqual(describe_tool("Write", {"file_path": "/a/b/index.html"}), "Editing index.html")
        self.assertEqual(describe_tool("Skill", {"skill": "hyperframes"}), "Using the hyperframes skill")
        self.assertIsNone(describe_tool("TodoWrite", {}))

    def test_clean_export(self):
        self.assertEqual(clean_export({"res": "1080p", "fps": "30"}), {"res": "1080p", "fps": 30})
        self.assertEqual(clean_export(None), {"res": "4k", "fps": 60})
        self.assertEqual(clean_export({"res": "8k", "fps": 999}), {"res": "4k", "fps": 60})

    def test_failure_message(self):
        self.assertIn("isn't signed in", failure_message("Invalid API key · Please run /login"))
        self.assertIn("Something went wrong", failure_message("boom"))


if __name__ == "__main__":
    unittest.main()
