#!/bin/sh
# Install or update Tweensy on macOS (Apple Silicon) or Linux (x86-64).
#
#   curl -fsSL https://raw.githubusercontent.com/TravisSaper/tweensy/main/install.sh | sh
#
# Run it again any time to update. Options (environment variables):
#   TWEENSY_VERSION=v2.7.0     install that release instead of the latest
#   TWEENSY_NO_START=1         don't start Tweensy after installing
#   TWEENSY_PORT=9000          serve on this port instead of 8765 (saved for later runs)
#   TWEENSY_NO_MODIFY_PATH=1   don't add ~/.local/bin to your shell's PATH
#   TWEENSY_INSTALL_DIR, TWEENSY_BIN_DIR   where the app and the `tweensy` command go
# Your projects live in ~/Tweensy and are never touched by installing or updating.
set -eu

REPO="TravisSaper/tweensy"
INSTALL_DIR="${TWEENSY_INSTALL_DIR:-$HOME/.local/share/tweensy}"
BIN_DIR="${TWEENSY_BIN_DIR:-$HOME/.local/bin}"

say() { printf '  %s\n' "$*"; }
fail() { printf '\n  Error: %s\n\n' "$*" >&2; exit 1; }
from_source() {
  fail "$1
  You can still run Tweensy from source with Python 3.9+:
    git clone https://github.com/$REPO.git && cd tweensy && python3 app.py"
}

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) os=mac; ext=dmg ;;
  Darwin-*) from_source "The downloadable Mac app is for Apple Silicon (M1 and newer)." ;;
  Linux-x86_64|Linux-amd64) os=linux; ext=tar.gz ;;
  *) from_source "There's no downloadable Tweensy for $(uname -s) $(uname -m) yet." ;;
esac
command -v curl >/dev/null || fail "curl is needed to download Tweensy."

port="${TWEENSY_PORT:-}"
if [ -n "$port" ]; then
  case "$port" in *[!0-9]*) fail "TWEENSY_PORT must be a number, like 9000." ;; esac
  [ "$port" -ge 1024 ] && [ "$port" -le 65535 ] || fail "TWEENSY_PORT must be from 1024 to 65535."
fi

tag="${TWEENSY_VERSION:-}"
if [ -z "$tag" ]; then
  # The "latest release" page redirects to .../tag/vX.Y.Z; no API token or rate limit involved.
  tag=$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest" | sed 's|.*/tag/||')
  case "$tag" in v*) ;; *) fail "Couldn't find the latest Tweensy release. Check your internet connection." ;; esac
fi
asset="Tweensy-$os-$tag.$ext"

printf '\n  Installing Tweensy %s for %s\n\n' "$tag" "$os"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fL --progress-bar -o "$tmp/$asset" "https://github.com/$REPO/releases/download/$tag/$asset" ||
  fail "Couldn't download $asset. Does release $tag exist?"

mkdir -p "$INSTALL_DIR" "$BIN_DIR"
if [ "$os" = mac ]; then
  hdiutil attach -nobrowse -readonly -quiet -mountpoint "$tmp/mnt" "$tmp/$asset"
  cp "$tmp/mnt/Tweensy" "$tmp/tweensy"
  hdiutil detach -quiet "$tmp/mnt"
else
  tar -xzf "$tmp/$asset" -C "$tmp"
fi
chmod +x "$tmp/tweensy"
mv -f "$tmp/tweensy" "$INSTALL_DIR/tweensy"  # replacing the file works even if Tweensy is running
ln -sf "$INSTALL_DIR/tweensy" "$BIN_DIR/tweensy"
say "Installed: $INSTALL_DIR/tweensy"
say "Command:   $BIN_DIR/tweensy"

case ":$PATH:" in
  *":$BIN_DIR:"*) on_path=1 ;;
  *) on_path=0 ;;
esac
if [ "$on_path" = 0 ] && [ -z "${TWEENSY_NO_MODIFY_PATH:-}" ]; then
  case "${SHELL:-}" in
    */zsh) rc="$HOME/.zshrc" ;;
    */bash) rc="$HOME/.bashrc" ;;
    *) rc="$HOME/.profile" ;;
  esac
  line="export PATH=\"$BIN_DIR:\$PATH\""
  grep -qsF "$line" "$rc" || printf '\n# Added by the Tweensy installer\n%s\n' "$line" >> "$rc"
  say "Added $BIN_DIR to your PATH in $rc (open a new terminal for the \`tweensy\` command)."
fi

if [ -n "$port" ]; then
  mkdir -p "$HOME/Tweensy"
  printf '{"port": %s}\n' "$port" > "$HOME/Tweensy/settings.json"
  say "Port:      $port (change it later in Settings, or with: tweensy --port 9000)"
fi

printf '\n  Done. Open Tweensy any time by typing: tweensy\n'
say "Run this installer again to update. Your projects are in $HOME/Tweensy."
if [ -z "${TWEENSY_NO_START:-}" ]; then
  printf '\n  Starting Tweensy...\n'
  rm -rf "$tmp"; trap - EXIT  # exec below replaces this script, so clean up first
  exec "$INSTALL_DIR/tweensy"
fi
