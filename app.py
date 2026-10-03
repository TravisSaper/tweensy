#!/usr/bin/env python3
"""Tweensy: a local web app for making motion-graphics videos with Claude Code.

Run:  python3 app.py   (Windows: py app.py, or double-click "Start Tweensy.bat")
Then open http://localhost:8765 (it opens by itself). Another port: python3 app.py --port 9000

Each project is a folder in ./projects. Messages you send are handed to Claude Code
(`claude -p`) running inside that folder, so it can build and render HyperFrames videos.
It uses the Claude Code you have installed and signed in to your own Claude plan.
Works on macOS, Windows and Linux with only the Python standard library (3.9+).
The code lives in the tweensy package; this file just starts it.
"""

from tweensy.server import main

if __name__ == "__main__":
    main()
