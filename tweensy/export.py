"""Per-project export settings (shape, 1080p or 4K, 24 or 60 fps) and the note that tells Claude."""

from .progress import PROGRESS_LOG

DEFAULT_EXPORT = {"aspect": "16:9", "res": "4k", "fps": 60}
EXPORT_RES = {"1080p", "4k"}
EXPORT_FPS = {24, 60}

# shape -> (composition size, HyperFrames 4K preset, 4K output size)
ASPECTS = {
    "16:9": ("1920x1080", "landscape-4k", "3840x2160"),
    "9:16": ("1080x1920", "portrait-4k", "2160x3840"),
    "1:1": ("1080x1080", "square-4k", "2160x2160"),
}


def clean_export(value):
    value = value if isinstance(value, dict) else {}
    aspect = value.get("aspect") if value.get("aspect") in ASPECTS else DEFAULT_EXPORT["aspect"]
    res = value.get("res") if value.get("res") in EXPORT_RES else DEFAULT_EXPORT["res"]
    try:
        fps = int(value.get("fps"))
    except (TypeError, ValueError):
        fps = DEFAULT_EXPORT["fps"]
    if fps == 30:  # 30 fps was replaced by 24 fps; keep older projects on the calmer option
        fps = 24
    return {"aspect": aspect, "res": res, "fps": fps if fps in EXPORT_FPS else DEFAULT_EXPORT["fps"]}


def render_note(export):
    """Appended to every message so Claude builds and renders at the shape, size and frame rate
    picked in the app."""
    aspect, fps = export["aspect"], export["fps"]
    size, preset, size_4k = ASPECTS[aspect]
    if export["res"] == "4k":
        label = f"{aspect}, 4K ({size_4k}) at {fps} fps, highest quality"
        flags = f"--quality high --crf 12 --fps {fps} --resolution {preset}"
        build = f"Build the composition at {size}; the --resolution flag renders it at {size_4k}."
    else:
        w, h = size.split("x")
        label = f"{aspect}, 1080p ({size}) at {fps} fps, highest quality"
        flags = f"--quality high --crf 12 --fps {fps}"
        build = f"Build the composition at {size} ({w} wide, {h} tall) and don't add --resolution."
    return (f"\n\n---\nExport setting (from the Tweensy app): {label}.\n"
            f"This shape was picked in the app, so use {aspect} even if the message mentions another shape.\n"
            f"{build}\n"
            f"Render with: mkdir -p {PROGRESS_LOG.parent.as_posix()} && npx hyperframes render . {flags} "
            f"-o <output file> 2>&1 | tee {PROGRESS_LOG.as_posix()}\n"
            "Run it in the foreground with the longest Bash timeout and wait for it to finish; don't run it in the "
            "background. (Keep the tee part: Tweensy reads that log to show a progress bar.)\n"
            "If you're adding graphics over the user's own footage, match that footage's shape, size and frame "
            "rate instead.")
