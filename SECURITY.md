# Security

Tweensy is a local app. Things worth knowing:

- The server binds to `127.0.0.1` only, so other devices on your network can't reach it.
- It has no login. Anything running on your own computer can call its API, the same as it could run
  `claude` directly.
- Claude Code runs headless with `--permission-mode acceptEdits` and the allowlist in
  `ALLOWED_TOOLS` (`tweensy/claude.py`). Tools outside the list are refused. The allowlist includes `npx`,
  `node`, `curl`, `python` and package managers, which can run arbitrary code. Treat it like letting
  Claude Code work in that folder with those permissions.
- Uploaded files are written only inside the chosen project folder. Names are sanitised, and
  `/files/` refuses paths outside the project.

If you find a security problem, please open a private issue or contact the maintainer directly
instead of posting details publicly.
