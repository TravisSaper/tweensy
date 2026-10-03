# Installing Tweensy (for AI agents)

You are installing Tweensy, a local web app that makes motion-graphics videos by chatting with
Claude Code. Follow these steps in order and tell the user what you did.

## 1. Check the computer

- **macOS on Apple Silicon (arm64) or Linux on x86-64:** use step 2a.
- **Windows 10/11, 64-bit:** use step 2b.
- **Anything else** (Intel Mac, Linux on ARM): use step 2c.

If the user asked for a specific port, add `TWEENSY_PORT=<port>` as shown (a number from 1024 to
65535). Otherwise leave it out; the default is 8765.

## 2a. macOS (Apple Silicon) or Linux

```sh
curl -fsSL https://raw.githubusercontent.com/TravisSaper/tweensy/main/install.sh | TWEENSY_NO_START=1 sh
# with a port:  ... | TWEENSY_NO_START=1 TWEENSY_PORT=9000 sh
```

This puts the app in `~/.local/share/tweensy` and a `tweensy` command in `~/.local/bin`
(added to the shell's PATH if needed). No admin rights are needed.

## 2b. Windows (PowerShell)

```powershell
$env:TWEENSY_NO_START = "1"; irm https://raw.githubusercontent.com/TravisSaper/tweensy/main/install.ps1 | iex
# with a port, first run:  $env:TWEENSY_PORT = "9000"
```

This puts `tweensy.exe` in `%LOCALAPPDATA%\Programs\Tweensy`, adds it to the user PATH and makes a
Start menu shortcut. No admin rights are needed.

## 2c. From source

Needs Python 3.9 or newer and git:

```sh
git clone https://github.com/TravisSaper/tweensy.git
cd tweensy
python3 app.py --no-browser      # add --port 9000 for another port
```

## 3. Claude Code

Tweensy needs Claude Code signed in to a paid Claude plan. Check with `claude --version`. If it's
missing, install it (`curl -fsSL https://claude.ai/install.sh | bash`, or on Windows
`irm https://claude.ai/install.ps1 | iex`). Signing in is interactive, so ask the user to run
`claude` themselves and log in. Don't do it for them.

Node.js 22+, FFmpeg and the HyperFrames skills are also needed, but Tweensy's **Setup** screen finds
what's missing and can install it, so you don't have to.

## 4. Finish

Tell the user:

- Start it by typing `tweensy` (Windows: also the Start menu). It opens http://localhost:8765, or
  the port they chose.
- To update, run the same install command again. Projects in `~/Tweensy` are kept.
- To change the port later: **Settings → Port** in the app, or `tweensy --port 9000`.
