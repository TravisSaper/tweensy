"""Per-project export quality (1080p or 4K, 30 or 60 fps) and the note that tells Claude."""

from .progress import PROGRESS_LOG

DEFAULT_EXPORT = {"res": "4k", "fps": 60}
EXPORT_RES = {"1080p", "4k"}
EXPORT_FPS = {30, 60}


def clean_export(value):
    value = value if isinstance(value, dict) else {}
    res = value.get("res") if value.get("res") in EXPORT_RES else DEFAULT_EXPORT["res"]
    try:
        fps = int(value.get("fps"))
    except (TypeError, ValueError):
        fps = DEFAULT_EXPORT["fps"]
    return {"res": res, "fps": fps if fps in EXPORT_FPS else DEFAULT_EXPORT["fps"]}


def render_note(export):
    """Appended to every message so Claude renders at the size and frame rate picked in the app."""
    fps = export["fps"]
    if export["res"] == "4k":
        label = f"4K at {fps} fps, highest quality"
        flags = f"--quality high --crf 12 --fps {fps} --resolution <landscape-4k | portrait-4k | square-4k>"
        size = ("Build the composition at 1920x1080 (16:9), 1080x1920 (9:16) or 1080x1080 (1:1) and pick the "
                "--resolution that matches its shape, so the file comes out at 3840x2160, 2160x3840 or 2160x2160.")
    else:
        label = f"1080p at {fps} fps, highest quality"
        flags = f"--quality high --crf 12 --fps {fps}"
        size = ("Build the composition at 1920x1080 (16:9), 1080x1920 (9:16) or 1080x1080 (1:1) and don't add "
                "--resolution.")
    return (f"\n\n---\nExport setting (from the Tweensy app): {label}.\n"
            f"Render with: mkdir -p {PROGRESS_LOG.parent.as_posix()} && npx hyperframes render . {flags} "
            f"-o <output file> 2>&1 | tee {PROGRESS_LOG.as_posix()}\n"
            "(Keep the tee part: Tweensy reads that log to show a progress bar.)\n"
            f"{size}\n"
            "If you're adding graphics over the user's own footage, match that footage's size and frame rate "
            "instead.")
