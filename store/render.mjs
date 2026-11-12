// Draws the extension icons and the Chrome Web Store images with headless Chrome.
// Run from the repo root: node store/render.mjs   (set CHROME=/path/to/chrome if needed)
// Writes icons/icon-{16,32,48,128}.png, store/screenshot-{1,2,3}.png, store/promo-440x280.png,
// and site/public/og.png (the picture shown when tascii-list.com is shared).
import { writeFileSync, mkdtempSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const tmp = mkdtempSync(join(tmpdir(), 'tascii-store-'));
const url = (p) => pathToFileURL(p).href;

// Gruvbox Material Dark, same as the panel's default theme.
const C = { bg: '#282828', text: '#d4be98', dim: '#a09176', accent: '#d8a657', ok: '#a9b665', info: '#7daea3', line: '#7c6f64' };
const FONT = '"JetBrainsMono NFM", "JetBrains Mono", ui-monospace, Menlo, monospace';

function shoot(name, html, w, h, out, transparent = false) {
  const file = join(tmp, `${name}.html`);
  writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;font-family:${FONT}}</style>${html}`);
  execFileSync(chrome, ['--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--user-data-dir=${join(tmp, 'profile')}`, '--allow-file-access-from-files', '--virtual-time-budget=1500',
    ...(transparent ? ['--default-background-color=00000000'] : []),
    `--window-size=${w},${h}`, `--screenshot=${out}`, url(file)], { stdio: 'ignore' });
  console.log('wrote', out.replace(`${root}/`, ''));
}

// --- Icons: [x] on a dark rounded square. 128 keeps 16px clear around the art, as the store asks. ---
mkdirSync(join(root, 'icons'), { recursive: true });
for (const [size, box, font, radius, label] of [[16, 16, 13, 3, 'x'], [32, 32, 12, 6, '[x]'], [48, 48, 17, 9, '[x]'], [128, 96, 42, 18, '[x]']]) {
  const glyphs = label === 'x' ? `<b style="color:${C.ok}">x</b>` : `<span>[</span><b style="color:${C.ok}">x</b><span>]</span>`;
  shoot(`icon-${size}`, `<div style="position:absolute;left:${(size - box) / 2}px;top:${(size - box) / 2}px;width:${box}px;height:${box}px;
    border-radius:${radius}px;background:${C.bg};display:grid;place-items:center;color:${C.text};font-size:${font}px;font-weight:800;
    letter-spacing:-0.04em;line-height:1">${`<div>${glyphs}</div>`}</div>`, size, size, join(root, 'icons', `icon-${size}.png`), true);
}

// --- The real panel with demo tasks, for the screenshots. ---
const now = new Date().toISOString();
const demo = (theme, size, after = '') => {
  const setup = join(tmp, `demo-${theme}.js`);
  writeFileSync(setup, `
    __store.tiles = [{ id: 'main', name: 'today', collapsed: false }, { id: 'w', name: 'work', collapsed: false }, { id: 'g', name: 'groceries', collapsed: true }];
    __store.tasks = [
      { id: '1', text: 'stretch for ten minutes', done: false, tile: 'main' },
      { id: '2', text: 'reply to the landlord', done: false, tile: 'main' },
      { id: '3', text: 'water the plants', done: true, doneAt: '${now}', tile: 'main' },
      { id: '8', text: 'old idea', deleted: true, deletedAt: '${now}', tile: 'main' },
      { id: '4', text: 'review the pull request', done: false, tile: 'w' },
      { id: '5', text: 'write release notes', done: true, doneAt: '${now}', tile: 'w' },
      { id: '6', text: 'eggs', done: false, tile: 'g' }, { id: '7', text: 'bread', done: false, tile: 'g' },
    ];
    prefs = { theme: '${theme}', size: ${size} };
    applyPrefs();
    setTimeout(() => { document.querySelector('.history').open = true; ${after} }, 60);`);
  const page = join(tmp, `panel-${theme}.html`);
  writeFileSync(page, readFileSync(join(root, 'panel.html'), 'utf8')
    .replace('<meta charset="utf-8">', `<meta charset="utf-8"><base href="${url(root)}/">`)
    .replace('<script src="panel.js"></script>',
      `<script src="${url(join(root, 'tests/stub.js'))}"></script><script src="${url(setup)}"></script><script src="panel.js"></script>`));
  return url(page);
};

// A 1280x800 frame: words on the left, the panel on the right where Chrome's side panel sits.
const screen = (bg, fg, dim, accent, headline, lines, panelSrc) => `
  <div style="position:absolute;inset:0;background:${bg};color:${fg}">
    <div style="position:absolute;left:96px;top:0;bottom:0;width:700px;display:flex;flex-direction:column;justify-content:center;gap:28px">
      <div style="font-size:22px;color:${accent};font-weight:800">[x] tascii</div>
      <div style="font-size:46px;font-weight:800;line-height:1.15">${headline}</div>
      <pre style="margin:0;font:inherit;font-size:20px;line-height:1.7;color:${dim}">${lines}</pre>
    </div>
    <iframe src="${panelSrc}" style="position:absolute;right:0;top:0;width:400px;height:800px;border:0;border-left:1px solid ${C.line}"></iframe>
  </div>`;

shoot('screen-1', screen(C.bg, C.text, C.dim, C.accent, 'a to-do list that<br>lives in your side panel',
  `stack lists in tiles, fold them, drag them\ncross things off with a little [x] spin\nnothing leaves your computer`, demo('gruvbox', 16)),
1280, 800, join(root, 'store', 'screenshot-1.png'));
shoot('screen-2', screen('#1c1c1c', '#e6e6e6', '#9f9f9f', '#8ab4f8', 'hands on the<br>keyboard',
  `j / k      move\nspace      cross off\ne          edit the words\nx  /  u    delete  /  undo\nJ / K      move a tile`, demo('dark', 16, "document.querySelector('.task').focus();")),
1280, 800, join(root, 'store', 'screenshot-2.png'));
shoot('screen-3', screen('#fafafa', '#1f1f1f', '#616161', '#1a5fc8', 'gruvbox, dark<br>or light',
  `text from 13 to 26px\nfor easier reading`, demo('light', 17, "document.querySelectorAll('.fold')[1].click(); document.getElementById('prefs-btn').click();")),
1280, 800, join(root, 'store', 'screenshot-3.png'));

// --- Small promo tile. ---
shoot('promo', `<div style="position:absolute;inset:0;background:${C.bg};color:${C.text};display:flex;flex-direction:column;justify-content:center;padding:0 44px;gap:14px">
  <div style="font-size:54px;font-weight:800;line-height:1"><span>[</span><span style="color:${C.ok}">x</span><span>]</span> <span style="color:${C.accent}">tascii</span></div>
  <div style="font-size:17px;color:${C.dim};line-height:1.5">a minimalist ASCII to-do list<br>for Chrome's side panel</div>
  <div style="font-size:15px;color:${C.line}">────────────────────────────────</div></div>`,
440, 280, join(root, 'store', 'promo-440x280.png'));

// --- Link preview for the website, 1200x630. The block logo comes from the README. ---
const logo = readFileSync(join(root, 'README.md'), 'utf8').split('\n').slice(1, 9).filter((l) => l.trim()).join('\n');
shoot('og', `<div style="position:absolute;inset:0;background:#1d2021;padding:28px">
  <div style="position:relative;height:100%;background:${C.bg};border:2px solid ${C.accent};display:flex;flex-direction:column;justify-content:center;gap:34px;padding:0 84px">
    <div style="position:absolute;top:-15px;left:24px;padding:0 12px;background:${C.bg};color:${C.accent};font-size:22px;font-weight:800;line-height:1.2">tascii-list.com</div>
    <pre style="margin:0;font:inherit;font-size:40px;line-height:1;color:${C.accent}">${logo}</pre>
    <div style="font-size:36px;font-weight:800;color:${C.text};line-height:1.35">a minimalist ASCII to-do list<br>for Chrome's side panel</div>
    <div style="font-size:26px;color:${C.dim}"><span style="color:${C.ok}">[x]</span> free, open source, private</div></div></div>`,
1200, 630, join(root, 'site', 'public', 'og.png'));

rmSync(tmp, { recursive: true, force: true });
