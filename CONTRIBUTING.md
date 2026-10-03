# Contributing

Thanks for helping. A few ground rules keep Tweensy easy to run for non-coders.

## Principles

- **Standard library only.** No `pip install`. The app must start with a plain `python3 app.py`
  on Python 3.9+.
- **No build step for the page.** Plain HTML, one stylesheet and native ES modules in `static/js/`.
- **Plain words in the UI.** The person using it may never have opened a terminal.
- **Works on macOS, Windows and Linux.** Anything OS-specific goes through a helper
  (`kill_tree`, `popen_group_kwargs`, `find_claude` in `tweensy/system.py`).

## Where things live

| File | What's in it |
| --- | --- |
| `tweensy/server.py` | HTTP routes, static files, `main()` |
| `tweensy/chat.py` | One chat turn: start Claude Code, stream events, save the reply, Stop |
| `tweensy/claude.py` | Tool allowlist, Claude's instructions, the command line, step descriptions |
| `tweensy/export.py`, `progress.py` | Export settings and render note; render-log progress |
| `tweensy/projects.py`, `system.py`, `config.py` | Project storage; installed tools and setup checks; paths and OS facts |
| `static/js/*.js` | One module per part of the page (`chat`, `guide`, `sketch`, `export`, `setup`, `videos`, …), started by `main.js` |

## Run it from source

```sh
python3 app.py              # opens http://localhost:8765
python3 app.py --no-browser # don't open a browser tab
```

## Tests

```sh
python3 -m unittest discover -s tests -v
```

The tests start a real server on a free port with temporary folders. They don't need Claude Code,
Node or FFmpeg. CI runs them on Ubuntu, macOS and Windows with Python 3.9 and 3.13.

## Changing the examples

Examples, styles and chips live in `tweensy/guide.py` as data. Write examples in the
*What / Look / Timing / Output* shape, and put anything the user should swap in **[brackets]**.
Don't put render size or frame rate in an example: the Export picker adds those. Each item has a `kind`:

| kind | UI | Button |
| --- | --- | --- |
| `prompt` | card | **Add this prompt** (adds to the chat box) |
| `style` | card | **Add this style** (adds to the chat box) |
| `tweak` / `move` | chip | fills the chat box with a one-line change |

Each section has an `id`, and the bottom-nav menus in `static/js/guide.js` (`TABS`) group sections by
id. A new section must be added to a menu; `tests/test_server.py` checks this.

## Releasing

1. Bump `__version__` in `tweensy/__init__.py` and add a section to `CHANGELOG.md`.
2. Commit, then tag: `git tag v2.5.0 && git push --tags`.
3. The **Release** workflow runs the tests, then builds the app with PyInstaller on Windows, macOS and
   Linux (`scripts/build_app.py`), starts each build to check it (`scripts/smoke_test.py`), and
   attaches all three files to one GitHub release.

## Pull requests

- One change per PR, with a line in `CHANGELOG.md` under *Unreleased*.
- If you touch the UI, add before/after screenshots.
- Make sure `python3 -m unittest discover -s tests` passes.
