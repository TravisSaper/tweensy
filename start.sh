#!/bin/sh
# Start Tweensy on Linux (or Mac from a terminal).
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Tweensy needs Python 3.9 or newer. Install python3 with your package manager."
  exit 1
fi
exec python3 app.py "$@"
