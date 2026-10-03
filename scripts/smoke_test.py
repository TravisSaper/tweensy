#!/usr/bin/env python3
"""Start a built Tweensy app and check it serves the page and answers the API.

    python scripts/smoke_test.py dist/tweensy
"""

import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request

PORT = "8799"


def get(path):
    with urllib.request.urlopen(f"http://127.0.0.1:{PORT}{path}", timeout=5) as res:
        return res.status, res.headers.get("Content-Type", ""), res.read()


def main(binary):
    home = tempfile.mkdtemp()  # keep the test's Tweensy folder out of the real home folder
    env = dict(os.environ, TWEENSY_PORT=PORT, HOME=home, USERPROFILE=home)
    proc = subprocess.Popen([binary, "--no-browser"], env=env)
    try:
        for _ in range(60):
            try:
                status = json.loads(get("/api/status")[2])
                break
            except OSError:
                time.sleep(1)
        else:
            sys.exit("The app didn't start within 60 seconds.")
        print("version", status["version"], "on", status["os"],
              "| Claude Code found:", status["claude_version"] or "no (fine on build machines)")
        code, _, body = get("/")
        assert code == 200 and b"Tweensy" in body, "page didn't load"
        code, ctype, _ = get("/js/main.js")
        assert code == 200 and "javascript" in ctype, "page scripts didn't load"
        guide = json.loads(get("/api/guide")[2])
        assert len(guide) >= 10, "guide is missing"
        print("smoke test passed")
    finally:
        proc.terminate()
        proc.wait(timeout=15)


if __name__ == "__main__":
    main(sys.argv[1])
