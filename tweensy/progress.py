"""Live render progress, read from the log every render writes through `tee`."""

import re
import time
from pathlib import Path

PROGRESS_LOG = Path(".tweensy/render.log")  # relative to the project folder
ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
PROGRESS_LINE = re.compile(r"(\d{1,3})%\s+(\S.*?)\s*$")


def read_render_progress(log_path, since):
    """The latest "NN%  stage" line HyperFrames printed, if the log was written after `since`."""
    try:
        if log_path.stat().st_mtime < since:
            return None
        with log_path.open("rb") as fh:
            fh.seek(max(0, log_path.stat().st_size - 8192))
            tail = fh.read().decode("utf-8", "replace")
    except OSError:
        return None
    for line in reversed(re.split(r"[\r\n]+", ANSI.sub("", tail))):
        m = PROGRESS_LINE.search(line)
        if m and not line.lstrip().startswith(("[", "{")):
            return min(int(m.group(1)), 100), m.group(2)
    return None


def watch(proc, log_path, since, on_progress):
    """Tail the render log until `proc` exits, reporting percent, stage and time left."""
    last, base = None, None  # base: (time, percent) when frame capture started
    while proc.poll() is None:
        got = read_render_progress(log_path, since)
        if got and got != last:
            percent, stage = got
            now = time.time()
            if last and percent < last[0]:
                base = None  # a new render started
            if base is None and percent >= 25:
                base = (now, percent)
            eta = None
            if base and percent > base[1] + 4 and percent < 100:
                eta = round((now - base[0]) * (100 - percent) / (percent - base[1]))
            on_progress({"kind": "progress", "percent": percent, "stage": stage, "eta": eta})
            last = got
        time.sleep(0.5)
