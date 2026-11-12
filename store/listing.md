# Chrome Web Store listing

Copy each part into the matching field in the developer dashboard.

## Package
Run `./pack.sh` on a tagged release. It runs the tests, then writes `tascii-v<version>.zip`. Upload that zip.

## Store listing tab

**Name** (from the manifest): tascii

**Summary** (from the manifest, 132 characters max): A minimalist ASCII to-do list.

**Description:**

```
tascii is a minimalist to-do list that lives in Chrome's side panel, drawn in plain ASCII.

- Lists in tiles: stack them, rename them, fold them, drag them into order.
- Cross a task off and it spins [ ] to [x], throws a few sparks and moves to that tile's history.
- Deleted tasks go to history too, so nothing is lost by accident. Press u to undo.
- Click a task's words to fix a typo.
- A progress bar for today: [#####-----------] 2/7 today.
- Fully keyboard driven: j/k move, space crosses off, e edits, x deletes, u undoes, i adds, J/K move a tile.
- Three themes (gruvbox, dark, light) and text sizes from 13 to 26px.

Private by design: tasks are saved only in your browser. No account, no tracking, no network requests.

Open source: https://github.com/moontourist/tascii
```

**Category:** Productivity → Tools (or Workflow & Planning, if offered)

**Language:** English

**Images:**
- Store icon: `icons/icon-128.png`
- Screenshots (1280x800): `store/screenshot-1.png`, `store/screenshot-2.png`, `store/screenshot-3.png`
- Small promo tile (440x280): `store/promo-440x280.png`

**Homepage URL:** https://tascii-list.com

## Privacy tab

**Single purpose:**

```
A to-do list shown in Chrome's side panel.
```

**Permission justification:**
- `sidePanel`:
  ```
  Shows the to-do list in Chrome's side panel when the toolbar icon is clicked.
  ```
- `storage`:
  ```
  Saves the user's tasks and lists locally in the browser so they are still there next time.
  ```

**Remote code:** No, I am not using remote code. (All scripts ship in the package; the content security policy only allows the extension's own files.)

**Data usage:** tick none of the data types. tascii collects no user data, so all three certifications can be confirmed truthfully:
- does not sell or transfer user data to third parties
- does not use or transfer user data for purposes unrelated to the item's single purpose
- does not use or transfer user data to determine creditworthiness or for lending

**Privacy policy URL:** https://tascii-list.com/privacy

## Updating later
1. Bump `version` in `manifest.json`, commit, and tag `v<version>`.
2. Run `./pack.sh`.
3. In the dashboard, open tascii → Package → Upload new package, then submit for review.
