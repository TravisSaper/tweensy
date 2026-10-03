#!/bin/bash
# Double-click to start Tweensy on a Mac.
cd "$(dirname "$0")" || exit 1
if ! python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' >/dev/null 2>&1; then
  echo
  echo "  Tweensy needs Python 3.9 or newer."
  echo "  If a box popped up asking to install developer tools, click Install, then open this file again."
  echo "  Otherwise get Python from https://www.python.org/downloads/"
  echo
  open "https://www.python.org/downloads/" 2>/dev/null
  read -n 1 -s -r -p "  Press any key to close."
  exit 1
fi
exec python3 app.py
