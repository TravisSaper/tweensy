#!/usr/bin/env python3
"""Build the downloadable app for the computer this runs on, ready to attach to a release.

    pip install pyinstaller
    python scripts/build_app.py

Writes one file to dist/release/:
  Windows  Tweensy-windows-vX.Y.Z.exe
  macOS    Tweensy-mac-vX.Y.Z.dmg       (open it, double-click Tweensy)
  Linux    Tweensy-linux-vX.Y.Z.tar.gz  (extract, run ./tweensy)
"""

import os
import platform
import shutil
import subprocess
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tweensy import __version__  # noqa: E402

DIST = ROOT / "dist"
OUT = DIST / "release"
SYSTEM = {"Windows": "windows", "Darwin": "mac"}.get(platform.system(), "linux")


def pyinstaller():
    subprocess.run([sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--onefile",
                    "--name", "tweensy", "--distpath", str(DIST), "--workpath", str(ROOT / "build"),
                    "--specpath", str(ROOT / "build"),
                    "--add-data", f"{ROOT / 'static'}{os.pathsep}static",
                    str(ROOT / "app.py")], check=True)
    return DIST / ("tweensy.exe" if SYSTEM == "windows" else "tweensy")


def package(binary):
    OUT.mkdir(parents=True, exist_ok=True)
    name = f"Tweensy-{SYSTEM}-v{__version__}"
    if SYSTEM == "windows":
        target = OUT / f"{name}.exe"
        shutil.copy2(binary, target)
    elif SYSTEM == "mac":
        stage = DIST / "dmg"
        shutil.rmtree(stage, ignore_errors=True)
        stage.mkdir()
        shutil.copy2(binary, stage / "Tweensy")
        target = OUT / f"{name}.dmg"
        target.unlink(missing_ok=True)
        subprocess.run(["hdiutil", "create", "-volname", "Tweensy", "-srcfolder", str(stage),
                        "-ov", "-format", "UDZO", str(target)], check=True)
    else:
        target = OUT / f"{name}.tar.gz"
        with tarfile.open(target, "w:gz") as tar:
            tar.add(binary, arcname="tweensy")
    return target


if __name__ == "__main__":
    built = package(pyinstaller())
    print(f"Built {built} ({built.stat().st_size // (1024 * 1024)} MB)")
