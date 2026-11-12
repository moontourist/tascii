#                            
                           
 █▄                        
▄██▄                  ▀▀ ▀▀
 ██ ▄▀▀█▄ ▄██▀█ ▄███▀ ██ ██
 ██ ▄█▀██ ▀███▄ ██    ██ ██
▄██▄▀█▄███▄▄██▀▄▀███▄▄██▄██
                           
                           
a minimalist ASCII to-do list for Chrome's side panel.

## Install
1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. Pin tascii and click its icon to open the panel.

## Use
- Tasks live in **tiles**, boxed lists you can stack (today, work, groceries...). `[ + tile ]` adds one.
- Click a tile's name to rename it, `-`/`+` to collapse it, and drag its top bar to move it. Its `x` deletes it (it asks first if the tile has tasks).
- Type a task in a tile and press Enter.
- Click a task to cross it off. It moves to **history**, where clicking it brings it back.
- Click `x` to delete a task for good.

## Keys
tascii opens on your first task, ready for these. If keys do nothing, click the panel first: the hint line at the bottom says so when the web page has your keyboard.

| Key | Does |
|---|---|
| `Esc` or `↓` | leave the input and go to the list |
| `j` / `k` (or `↓` / `↑`) | move down / up through tiles and tasks |
| `h` / `l` (or `←` / `→`) | move between a task and its `x` |
| `space` | cross off (or restore, in history) |
| `x` | delete the selected task |
| `i` or `/` | back to the tile's input (opens it if collapsed) |
| `J` / `K` (or shift `↓` / `↑`) | move the tile down / up |
| `r` | rename the tile |
| `N` | new tile |

Tasks are saved locally in Chrome and never leave your computer. The extension can't read websites or make network requests.

## Test
`node tests/run.mjs` checks permissions, the security policy, that the version matches the git tag, and banned code patterns. It then runs the panel in headless Chrome with fake storage, HTML-injection attempts and corrupted data.


