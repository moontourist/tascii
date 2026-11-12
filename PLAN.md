# tascii plan (Chrome extension)
tests
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

## Round 2: readability and history

Feedback on v1.0.0: the logo is squished and doesn't scale, the text and boxes are too small to read and click, finishing a task should animate and move it to a history, and the date should show in the top right.

### v1.1.0: header
- Replace the big block logo with a small one-line header: `tascii` in yellow on the left, today's date on the right (for example `thu 12 nov`), with an ASCII rule underneath.
- The date updates itself at midnight, because the side panel can stay open for days.
- Plain text, so it stays sharp at any panel width and costs nothing to load.
- Alternative if you'd rather keep the full logo: a fixed-size image of it. That means a small file to load each time, and it can't change size with the panel.

### v1.2.0: bigger and easier to click
- Base text size up from 13px to 15px. Rows get more line spacing.
- Clicking anywhere on a task row (box or text) marks it done, not just the `[ ]`.
- Every clickable part is at least 32px tall, and `x` gets a wider click area.
- Hovering a row highlights it so you can see what you're about to click.
- Long tasks still wrap instead of stretching the panel.

### v1.3.0: cross-out animation and history
- Marking a task done draws a line through it from left to right (about 0.3s), then the row fades and slides out of the list (about 0.2s).
- The task is saved as done the moment you click, so closing the panel mid-animation loses nothing.
- Done tasks get a `doneAt` date and move to a `history` section under the list. It's collapsed by default and shows a count, like `history (4)`.
- History lists the newest first, each with the date it was finished. Click one to put it back in the list. `x` deletes it for good.
- Tasks finished before this version have no `doneAt`, so history shows them without a date.
- If your computer is set to reduce motion, the task moves straight to history with no animation.

### v1.4.0: hotkeys
- `j`/`k` move down/up the list (and into an open history), `h`/`l` move between a task and its `x`.
- Space crosses off the focused task, or restores it in history. `i` or `/` goes to the input, `Esc` leaves it.
- Arrow keys do the same as hjkl. Keys with cmd, ctrl or alt are left alone so browser shortcuts still work.

### v1.4.1: security hardening and tests
- Strict content security policy in the manifest: only the extension's own files can load, and no network, plugins or forms.
- Stored data is checked when it's read, so junk in storage can't crash the panel.
- Task length limit (500 characters).
- `node tests/run.mjs` checks permissions, the policy, version/tag match, banned code patterns (HTML injection, `eval`, network calls), and runs the panel in headless Chrome with XSS payloads and corrupted data.

## Round 3: ASCII and feel

### v1.5.0: ASCII touches
- `[#####---------------] 1/4 today` progress bar under the header that grows one `#` at a time.
- A muted line of key hints at the bottom.

### v1.6.0: satisfying clicks
- Finishing: the box spins `[-] [\] [|] [/] [x]`, ASCII sparks (`* + . '`) burst out in Gruvbox colors, a green line strikes through, the row flashes, then slides away.
- Restoring spins the box back to `[ ]`. Deleting turns the row red and slides it left. New tasks slide in.
- Everything is saved before the animation starts, and reduced motion turns it all off.

### v1.6.1
- Removed the empty-list cat; an empty list just says `nothing to do.`

## Round 4: tiles

### v1.7.0: Hyprland-style tiles
- Each tile is its own to-do list in a box, with its title set into the top border and gaps between tiles. The focused tile's border turns yellow.
- Click the name to rename it, `-`/`+` to collapse it (a collapsed tile shows its open count), and `x` to delete it. A tile with tasks asks first (`del 3?`).
- Drag a tile's bar, or press `J`/`K`, to move it. The other tiles slide into place.
- `[ + tile ]` or `N` adds a tile with its name ready to type.
- Storage gains a `tiles` list and each task a `tile` id. Tasks from older versions land in the first tile, named `todo`.
- Muted text is now Gruvbox `#a89984` instead of `#928374`, so it passes the WCAG AA contrast minimum (4.5:1).
- Needs Chrome 123+ (for name fields that size to their text).

### v1.8.0: your palette, and keys that work on open
- Colors are only the Gruvbox-Dark palette by glenntatum: `#3c3836` background, `#8ec07c` aqua text, `#d79921` yellow accents, `#458588` blue lines, `#cc241d` red for delete. Blue and red stay off text because they're hard to read on the background.
- The panel opens on the first task, so hjkl work straight away. `i` goes to the input.
- When the panel doesn't have keyboard focus (you clicked the web page), the title dims, borders go blue, and the hint line says to click the panel.

### v1.8.1: contrast
- Faded text raised to 90% aqua (4.8:1). Hover no longer adds a background, which pushed text under 4.5:1; the `[ ]` turning yellow shows hover instead.

### v1.9.0: x deletes
- Pressing `x` on a selected task deletes it, with the same slide-out as clicking its `x`.

### v1.10.0: deletion history, undo, Rex colors
- `x` (key or button) sends a task to its tile's history as `[-]`, next to finished `[x]` tasks. Click it there (or space) to restore it, or `x` again to remove it for good.
- `u` undoes the newest deletion: a task sent to history, one removed for good, or a whole tile with its tasks. Undo covers deletions since the panel opened.
- Deleted tasks don't count toward today's progress.
- Colors now come from the Rex terminal theme gruvbox-starship: `#282828` background, `#fbf1c7` text, `#d79921` yellow, `#98971a` green, `#83a598` blue, `#665c54` lines, `#cc241d` red. Delete shows as cream on a red chip, since red text is hard to read on this background. All text passes WCAG AA.

## Install (developer mode)
1. Open `chrome://extensions` and turn on Developer mode.
2. Click "Load unpacked" and pick this folder.
3. Pin the extension and click its icon.
4. After changing files, click the reload arrow on the extension's card.

## Later (optional)
- Clear all history, `sync` storage across computers, a custom icon, a light theme.
