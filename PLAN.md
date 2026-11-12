# tascii plan (Chrome extension)
tests
A minimalist, ASCII-style to-do list in Chrome's side panel. Gruvbox dark colors. Plain HTML, CSS and JavaScript: no frameworks, no libraries, no build step, no internet requests.

## Speed rules
- No frameworks or libraries. Installed fonts only (JetBrains Mono, then the system monospace font).
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

### v1.10.1: the right theme
- Colors are Gruvbox Material Dark, the custom theme imported into Rex from Ghostty: `#282828` background, `#d4be98` text, `#d8a657` yellow, `#a9b665` green, `#7daea3` blue, `#7c6f64` lines, `#ea6962` red. Red is readable here, so delete is plain red text again.

### v1.11.0: JetBrains Mono
- Font is JetBrains Mono, using the copy installed on the computer (the Nerd Font Mono build first, for real bold), so nothing is downloaded. Falls back to the system monospace font if it isn't installed.

### v1.12.0: preferences
- `[ prefs ]` (or `p`) opens a box with the theme (gruvbox, dark, light) and text size (13 to 26px, `[-]`/`[+]` or the `-`/`+` keys). `Esc` closes it.
- Saved per computer in localStorage and applied by `prefs.js` in the page head, so the panel never flashes the default theme or size first.
- Every theme's text passes WCAG AA. The progress bar is 16 characters so it fits beside the count.

### v1.13.0: edit a task
- Click a task's words (or press `e`) to edit them in place, with the cursor where you clicked and the spellchecker on. Enter or clicking away saves, Esc cancels, and an empty edit keeps the old words.
- Clicking the `[ ]` or the space after the words still crosses the task off. Finished and deleted tasks in history aren't editable; restore one first.

### v1.14.0: GitHub link
- `[ github ]` next to `[ + tile ]` and `[ prefs ]` opens the repo in a new tab. The manifest's `homepage_url` points there too.
- The test that bans outside URLs allows exactly that link.

### v1.15.0: Chrome Web Store prep
- `[x]` icons at 16, 32, 48 and 128px (the toolbar shows these instead of a plain letter).
- `./pack.sh` runs the tests, then zips only the extension files as `tascii-v<version>.zip`. A test checks the zip list covers every file the extension uses.
- `store/`: three 1280x800 screenshots, a 440x280 promo tile, `listing.md` (description, privacy answers, permission reasons), and `render.mjs`, which redraws all images from the real panel.

### v1.15.1: quiet when embedded
- The panel doesn't grab keyboard focus when it runs inside a web page, so the website's live demo doesn't steal focus from the page.

### v1.16.0: theme wipe
- Changing the theme wipes the new one across from the left (a view transition, half a second). Not on first load, and not with reduced motion.

## Animations in the real side panel
The extension is the source of truth. The website's demo runs the extension's own `panel.js` and `panel.css`, so every fix here reaches the site too.
Reported: crossing off a task threw its sparks from the panel's top-left corner, and changing theme didn't wipe, it just changed a moment late. Both looked right on the website.

### v1.16.1: found and fixed
- Sparks: Chrome's storage hands saved data back with each task's fields in sorted order. The panel compares that against its own copy to skip its own saves, and the different order made every save look like it came from another window. So it redrew the list mid-animation, the row vanished, and the sparks measured a box that was no longer on screen (position 0,0). The site's demo storage keeps the original order, so it never happened there. Fix: `clean()` puts task fields in sorted order, so the comparison matches.
- Wipe: the animation only said where the wipe starts. With no end given, the browser can't slide between the two, so it held the old theme for half the time, then jumped. Fix: give both ends (also on the website).
- Tests: the fake storage now sorts fields like Chrome's, and a new check makes sure the sparks start on the task's box. With the old code 28 checks fail.
- Checked in a test copy of Chrome running the real extension: sparks start on the box at 13px and 26px text, with the list scrolled and not, and the wipe slides across.

### Phase 2 (v1.17.0): animations that follow the text size
- Bigger or smaller text moves every row. Sparks are placed once, by screen position, so changing the size (or scrolling) while they fly leaves them behind. Start them inside the task's row instead, so they move with it at any size.
- Same check for the other moving parts: the strike line, the row slide, and tiles moving with J/K or dragging.
- The test runs the cross-off at all six text sizes (13 to 26px) and with the list scrolled.

### Phase 3 (v1.18.0): no redraws mid-animation
- A real change from another window, or the midnight redraw, can still land during an animation. Hold it until the animation ends, then apply it.

### Phase 4 (v1.19.0): check it the way you see it
- `tests/motion.mjs` loads the real extension into a test copy of Chrome and saves frames of each animation (cross-off, restore, delete, theme wipe) at the smallest and largest text, so a change can be checked by eye before release.
- A short checklist here for the side panel itself: each theme, smallest and largest text, a long scrolled list.

## Website: tascii-list.com
Hosted on Cloudflare Pages from this repo. Website releases are tagged `site-vX.Y.Z`, separate from the extension's `vX.Y.Z`.

### Cloudflare Pages settings
- Production branch: the branch you deploy (now `chrome-extension`, later `main`).
- Build command: `sh site/build.sh`. Output directory: `site/dist`.
- Add the custom domain `tascii-list.com` under the project's Custom domains tab.

### site-v0.1.0: landing page
- `site/public/`: the page, laid out like a tiling window manager. Boxed windows with gaps, titles set into the borders, and a yellow border on the window under the mouse.
- Windows: readme (logo, what it is, install and source links), try it (the real panel running live), keys, and private.
- The live demo is the actual extension panel. `site/build.sh` copies `panel.*` and `prefs.js` into `site/dist/demo/` and adds `demo/shim.js`, which stands in for `chrome.storage` and keeps demo tasks in the visitor's localStorage.
- `privacy.html` is the privacy policy (also the URL for the Chrome Web Store form).
- JetBrains Mono is served from the site, cut down to the characters the page uses (17 KB per weight, OFL licence in `fonts/`).
- `_headers` sets a strict content security policy (own files only, no outside scripts, no framing by other sites), `nosniff` and no referrer.
- `og.png` is the picture shown when the link is shared. `node store/render.mjs` redraws it.
- Install links go to the GitHub install steps until the Chrome Web Store page exists; then swap in the store URL.

### site-v0.2.0: new logo, themes follow the demo
- New block logo, sized to fill the readme window at any width.
- Picking a theme in the demo changes the whole site, with the same wipe as the extension. Only the page runs the wipe; the demo inside it changes a moment later so it lands inside that wipe (two wipes at once can freeze Chrome).

### site-v0.2.1: wipe fix
- The theme wipe now slides instead of jumping halfway through (same fix as extension v1.16.1).

### site-v0.3.0: spinning [x]
- A new window, `[x]`, with the extension's icon as a spinning 3D solid drawn in ASCII, like the classic spinning donut. `spin.js` pushes the flat `[x]` shape out into a solid, turns it, and shades each character by which way the surface faces. The brackets are drawn in the text colour, the x in green.
- About 30 frames a second, only while it's on screen. Held still at an angle with reduced motion.
- The TASCII wordmark is smaller (at most 12px characters).

## Web app: tiling lists at tascii-list.com/app
Many lists open at once, tiled like Hyprland: every list is a window, new windows split the screen, and all of them resize to fit the browser window.

### Rust or JavaScript?
Plain JavaScript, no framework. The slow part of a page like this is drawing, and the browser's own engine (already compiled C++) does that. Rust compiled to WebAssembly would add a download and compile step before the first frame, and every change to the page would still have to go back through JavaScript. Working out where 20 windows go takes JavaScript well under a millisecond. Speed comes from staying small instead:
- Under 40 KB for the whole app, fonts aside. A test fails the build if it grows past that.
- First frame in under 100 ms on a normal laptop. Resizing and retiling stay within one frame (16 ms).
- No libraries, no network requests after the page loads.

### Phase 1 (site-v0.4.0): shared core
- Move the data rules out of `panel.js` into `core.js`: cleaning stored data, tasks, tiles, history and undo. The extension and the web app both load it, so a fix lands in both. Extension tests must still pass (extension v1.16.0).
- A small storage layer: `chrome.storage` in the extension, localStorage in the web app. The browser's `storage` event keeps several tabs of the web app in sync.

### Phase 2 (site-v0.5.0): the tiling layout
- Each list is a window. The layout is a tree of splits, like Hyprland's dwindle layout: a new window splits the focused one in half, side by side if it's wide, one above the other if it's tall.
- Window positions are worked out from the tree and the browser window's size, then set with CSS. A `ResizeObserver` (the browser telling us the size changed) retiles everything, so windows always fill the screen with even gaps.
- Each split remembers its ratio, so resizing keeps the proportions.
- Narrow screens (phones) fall back to one column you scroll, like the landing page.
- Checks: at several screen sizes, windows fill the screen, never overlap, keep their gaps and never get smaller than a usable minimum.

### Phase 3 (site-v0.6.0): keys and mouse
- Inside a window, the keys work as they do in the extension (j/k, space, e, x, u, i).
- Between windows: Shift+h/j/k/l moves focus to the window in that direction. `m` then h/j/k/l swaps the window that way. `n` opens a new window, `q` closes one (asks first if it has tasks), `f` makes one fill the screen and back, `t` turns its split from side by side to stacked.
- Alt is left alone (your window manager uses it), and so are the Ctrl shortcuts the browser owns.
- Mouse: drag the gap between two windows to resize them, drag a title bar to swap windows.

### Phase 4 (site-v0.7.0): workspaces
- Number keys 1 to 9 switch workspaces, each with its own windows and layout, like Hyprland. `M` then a number moves the focused window there.
- A one-line bar at the top shows them: `[1] 2 3`.

### Phase 5 (site-v0.8.0): keep your data safe
- Export to a file and import from one, so lists can move between computers, or between the web app and the extension.
- Ask the browser to keep the data (`navigator.storage.persist`) so it isn't cleared when space runs low.
- Works offline and can be installed as an app (a web app manifest and a small service worker that caches the files).

### Phase 6 (site-v0.9.0): feel
- Windows open and close with a short grow and shrink (off with reduced motion). The extension's spin, sparks and strike line come along through `core.js`.
- Themes and text sizes from the extension's prefs.
- Screen readers: each window is a named region, and moving focus says which window you're in.

### site-v1.0.0: launch
- A headless Chrome test harness like the extension's: layout, keys, workspaces, corrupt data, and the same injection checks.
- The size budget test, and the same strict content security policy as the landing page.
- `[ open the web app ]` on the landing page.

### Not planned
- Syncing between the web app and the extension, or between computers. That needs accounts and a server, and tascii's promise is that nothing leaves your browser. Export and import cover moving lists by hand.

## Install (developer mode)
1. Open `chrome://extensions` and turn on Developer mode.
2. Click "Load unpacked" and pick this folder.
3. Pin the extension and click its icon.
4. After changing files, click the reload arrow on the extension's card.

## Later (optional)
- Clear all history in one go.
