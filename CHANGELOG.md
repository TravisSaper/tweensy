# Changelog

All notable changes to Tweensy (called Motion Studio before 2.4.0). Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versions: [SemVer](https://semver.org/).

## [Unreleased]

## [2.8.0] - 2026-10-04

### Added
- **Render versions:** every render is saved as its own `renders/vNNN.mp4` with its prompt, time, length,
  size and fps. Creations lists them as "v3 · longer pause after reconnect"; play any version, **Restore**
  an older one (its source files come back too), or tick two and **Compare** them side by side.
- **Review in the chat:** each reply that rendered shows its video right under it. Click the comment bar
  under the video to pin a note to that moment; notes go with your next message as `[07.6s] …`.
- Suggestion chips come from Claude's latest reply, with its offered follow-up first.
- Hover a style card to see a short looping preview of how that style moves.
- **Your styles:** under the built-in styles, **+ Add your own style** lets you type the rules or design
  them with Claude in the chat; when Claude writes a style, **Save to Your styles** appears under its reply.
  Your styles work in every project and can be edited or deleted.
- **Open folder** button instead of the long project path.
- **Sidebar** like Paperclip's: **New project**, **Dashboard** (the chat workspace), **Projects** and
  **Video library**, with the Setup status at the bottom. On phones it becomes a strip at the top.
- **Projects** page: every project with its video count and whether Claude is working on it; click
  one to open it.
- **Video library:** click a project to drop down its videos, newest first, each with a thumbnail and
  the prompt that made it. Click a video and it grows into the middle of the screen and plays, with
  its prompt above (three lines, then **Show more**). Esc or a click outside sends it back.
- **No more duplicate uploads:** every file you add is kept once in an **Assets** folder (`~/Tweensy/assets`)
  and linked into each project that uses it, so the same logo in ten projects takes the space of one.
  **Add files** lists **Your uploads** to add to a project without uploading again. Move files into the
  Assets folder yourself and they aren't copied at all.

### Changed
- Claude's progress narration goes into the folded "What Claude did" list; the visible reply is only
  what changed, the final length and settings, and any open question.
- The project name is the top bar title; the chat column is wider with ~75-character lines.
- The Guide/Examples side panel always stays open, and both side panels run to the bottom of the window
  with the dock under the chat.
- **Settings** moved to the sidebar. The dock's **Export** tab is gone: shape, quality, frame rate and the
  special formats all live in the badge next to Send. Download is only in Creations.
- Styles can go before or after your request (the old "pick an example first" wording is gone); **Copy**
  buttons say what they copy; text contrast meets WCAG AA in both themes.
- **New look:** neutral grey light and dark themes, flatter panels with thin borders, smaller corners
  and text, and small uppercase panel labels. Everything you can click is **purple** now (it was blue);
  your own chat messages sit on a soft purple tint.

## [2.7.0] - 2026-10-03

### Added
- **Shape** in the export settings: 16:9, 9:16 or 1:1 (square), at 1080p or 4K. The shape you pick is
  the video's shape; using a storyboard sets it to the board's shape.
- A quick **export pop-up** on the badge next to Send: shape, quality and frame rate in one click each.
- The blue highlight in the bottom bar **slides** to the tab you pick.
- **Collapsible sidebar:** click the open tab again (or the sidebar button at the top left) to slide the
  left panel away and widen the chat; any tab brings it back. The choice is remembered.
- **Add files** opens a centred chooser over a blurred background that explains each folder (Project
  folder, Screenshots, Fonts, Sound effects). Click one to pick files (only matching file types are
  shown) or drag files onto it. Dialogs now blur what's behind them.
- **New project** and every question the app asks (storyboard labels, delete/clear scene, warnings)
  now use an in-app card over a blurred background instead of the browser's pop-up boxes. New project
  shows the folder name it will create, and what it becomes if that name is taken.
- **One-line install and update**, no download page needed:
  `curl -fsSL https://raw.githubusercontent.com/TravisSaper/tweensy/main/install.sh | sh` (Mac/Linux) or
  `irm https://raw.githubusercontent.com/TravisSaper/tweensy/main/install.ps1 | iex` (Windows). Run it
  again to update. It adds a `tweensy` command (and a Start menu shortcut on Windows).
  [docs/INSTALL.md](docs/INSTALL.md) lets a coding agent do the install for you.
- A **Settings** menu next to Fix: **System / Light / Dark** appearance (remembered) and the port.
- **Choose the port:** `TWEENSY_PORT=9000` when installing, then **Settings → Port** in the app or
  `tweensy --port 9000` any time later. The choice is saved in `settings.json`.
- Subtle motion: new messages slide up, buttons press, pop-ups and dialogs scale in.
  It all turns off when the system asks for reduced motion.

### Changed
- **24 fps** replaces 30 fps (choices are now 24 or 60). Projects saved at 30 fps move to 24.
- Everything you can click is now **blue**; purple stays the brand colour.
- Prompt, style, chip and starter buttons **add** to the chat box instead of replacing it
  ("Add this prompt", "Add this style").
- Example prompts no longer fix a shape; the export setting decides it. The "24 fps film look" chip
  is gone (it's in the picker now).

## [2.6.1] - 2026-10-03

### Fixed
- Claude could start a long render in the background and end its reply; the render was then stopped
  partway, so no video appeared and no progress bar showed. Renders now always run in the foreground
  (with the longest timeout) and Claude waits for them to finish.
- Hooks from your own Claude Code setup no longer run inside Tweensy (`disableAllHooks` for its runs),
  so personal hooks can't add noise or block steps. Skills still load.

## [2.6.0] - 2026-10-03

First public release.

### Changed
- Four new, original style presets: **Bold Type**, **Frosted Glass**, **Paper Print** and **Neon Pop**,
  each with its own fonts (downloaded from Google Fonts on first use), colours and motion rules.

## [2.5.0] - 2026-10-03

### Added
- Ready-to-run downloads in every release, one per computer: `Tweensy-windows-vX.Y.Z.exe`,
  `Tweensy-mac-vX.Y.Z.dmg` (Apple Silicon) and `Tweensy-linux-vX.Y.Z.tar.gz`. No Python needed.
  Each is built and smoke-tested on its own OS by the release workflow.
- Downloaded apps keep projects in a `Tweensy` folder in your home folder.

### Changed
- Releases no longer include a single zip; running from source is unchanged.

### Fixed
- Programs started by a downloaded Linux app (Claude Code, Node, FFmpeg) get the system's library
  path back instead of the app's bundled one.

## [2.4.0] - 2026-10-03

### Changed
- Renamed **Motion Studio → Tweensy**: app name, page, launchers (`Start Tweensy.command` / `.bat`),
  the `tweensy` Python package, the zip (`Tweensy-vX.Y.Z.zip`), the GitHub repo, and the port setting
  (`TWEENSY_PORT`). Render progress now goes to `.tweensy/render.log`.
- New screenshots and demo video.

## [2.3.0] - 2026-10-03

### Changed
- The drawing board is now a **storyboard**: a scene strip with thumbnails, **+ Add scene**, delete,
  and an optional **style & transition** note under each scene. **Use this storyboard** saves one
  image per scene and lists them in order with their notes.
- Claude is told to look at every scene first and, only if one is genuinely unclear, ask short
  numbered questions and wait instead of guessing.

## [2.2.0] - 2026-10-03

### Added
- **Sketch** menu with a drawing board (16:9 or 9:16): pen for layout, red arrows for motion (numbers
  give the order), blue text labels, eraser, undo (Ctrl+Z), clear, and a notes box. **Use this sketch**
  saves the drawing to `sketches/` and fills the chat box with a message explaining how to read it.
- Claude's instructions now say to open any sketch image before planning.

## [2.1.1] - 2026-10-03

### Changed
- Reorganised the code into a `motion_studio` package (server, chat, claude, export, progress,
  projects, system, config, guide) and split the page into `index.html`, `css/styles.css` and
  ES modules in `static/js/`. `python3 app.py` and the launchers work exactly as before.
- Tests split into `tests/test_server.py` and `tests/test_helpers.py`, with new checks for the page's
  CSS/JS files.

## [2.1.0] - 2026-10-03

### Added
- Live status card on every reply: Planning → Building → Rendering → Checking, with a timer.
- Real render progress bar with time left, read from HyperFrames' own output
  (`.motion-studio/render.log`, written via `tee` by every render).
- Clear finish: green "Done in m:ss · renders/x.mp4 is ready", tab title, and a desktop notification
  when the tab isn't focused.
- Reopening a project mid-run shows the live card and refreshes when the run finishes.

### Fixed
- Errors that stopped Claude early (such as the plan's usage limit) were hidden. They're now shown in
  plain words, with when the limit resets and to say "continue".

## [2.0.0] - 2026-10-02

First release.

### Added
- Local web app that turns plain-language requests into HyperFrames videos through your own
  signed-in Claude Code, with one conversation per project.
- Bottom navigation bar: **Guide**, **Examples**, **Animations**, **Styles**, **Export**, **Fix**
  (plus **Chat** and **Videos** on small screens).
- Examples written as *What / Look / Timing / Output* with **[brackets]** for the parts you swap:
  first video, 10-moves demo, text-only, product launch, app promo from screenshots, graphics on your
  own footage, change one moment, sound effects, transparent overlay.
- Four style presets to stack under any example.
- **Export picker** per project: 1080p or 4K, 30 or 60 fps. Every render uses `--quality high --crf 12`.
  The setting is sent with each message, and the composer badge shows it.
- Quality bar for Claude: deliberate easing, depth, crisp text, and checking frames from every
  finished render before replying.
- Live step feed, streaming replies, Stop, file uploads, and a video player that shows the real resolution.
- First-run Setup checklist (Claude Code, sign-in, Node.js 22+, FFmpeg, HyperFrames skills,
  whisper-cpp) with per-OS commands and a **Set up my computer** button.
- macOS, Windows and Linux launchers. Tests, CI on three OSes, a tag-driven release workflow,
  and `make_zip.py`.
