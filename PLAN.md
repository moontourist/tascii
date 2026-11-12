# tascii plan (Chrome extension)

A minimalist, ASCII-style to-do list in Chrome's side panel. Gruvbox dark colors. Plain HTML, CSS and JavaScript: no frameworks, no libraries, no build step, no internet requests.

## Speed rules
- No frameworks or libraries. System monospace font only.
- The logo and the input are plain HTML, so they appear on the first frame. The list fills in as soon as storage answers (a few milliseconds).
- The whole extension stays a few KB.

## Files
- `manifest.json`: tells Chrome what the extension is and what it may do.
- `background.js`: makes clicking the toolbar icon open the side panel.
- `panel.html`, `panel.css`, `panel.js`: the list itself.

## Versioning
- Versions follow semver (`MAJOR.MINOR.PATCH`). New feature: bump MINOR. Bug fix only: bump PATCH. `1.0.0` is the first version meant for daily use.
- The `version` in `manifest.json` and the git tag always match. Tag `v0.3.0` ships with `"version": "0.3.0"`.
- To release:
  1. Bump `version` in `manifest.json`.
  2. Commit.
  3. Add an annotated tag (a tag that carries a message): `git tag -a vX.Y.Z -m "what changed"`.
- Tags stay local until you push them with `git push --follow-tags`.

## Phases

### v0.1.0: skeleton
- Delete the old C# leftovers (`Program.cs`, `tascii.db`).
- Manifest V3 with the `sidePanel` and `storage` permissions.
- Clicking the icon opens a panel that shows the ASCII logo.

### v0.2.0: the look
- Gruvbox palette as CSS variables, monospace font, ASCII rule lines.
- `>` prompt input, with `[ ]` / `[x]` boxes and `x` to delete (static for now).

### v0.3.0: add and save
- Enter adds a task. Tasks are saved in `chrome.storage.local` and loaded on open.
- User text goes in with `textContent`, never `innerHTML`, so it can't inject HTML.

### v0.4.0: done and delete
- Click `[ ]` to toggle done. Click `x` to delete. Every change saves.

### v1.0.0: polish
- Keyboard focus kept after actions, an empty-list message, long tasks wrap.
- Panels open in two windows stay in sync.
- README explains how to install.

## Install (developer mode)
1. Open `chrome://extensions` and turn on Developer mode.
2. Click "Load unpacked" and pick this folder.
3. Pin the extension and click its icon.
4. After changing files, click the reload arrow on the extension's card.

## Later (optional)
- Clear finished tasks, `sync` storage across computers, a custom icon, a light theme.
