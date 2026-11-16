// The tascii home server: serves the panel as a web page and holds the one true copy of the list.
// Devices send small changes ("check off task 12"), never whole lists, so edits from two devices both survive.
// Node built-ins only. Settings come from environment variables:
//   PORT              port to listen on (default 8080)
//   TASCII_DATA       where the list is saved (default data/tascii.json)
//   TASCII_PASSWORD   if set, the browser asks for it (any username) before showing anything
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.TASCII_DATA ?? join(root, 'data', 'tascii.json');
const PORT = Number(process.env.PORT ?? 8080);
const PASSWORD = process.env.TASCII_PASSWORD ?? '';

// --- The list. A corrupt file stops the server instead of being overwritten. ---
let state = { rev: 0, tasks: [], tiles: [] };
mkdirSync(dirname(DATA), { recursive: true });
if (existsSync(DATA)) state = JSON.parse(readFileSync(DATA, 'utf8'));
function save() {
  state.rev++;
  writeFileSync(`${DATA}.tmp`, JSON.stringify(state));
  renameSync(`${DATA}.tmp`, DATA); // swap in whole, so a crash mid-write can't leave half a file
}

// --- Changes. Each one names a task or tile by id, so it can't erase something it never saw. ---
const str = (max) => (v) => typeof v === 'string' && v.length <= max;
const bool = (v) => typeof v === 'boolean';
const TASK = { tile: str(100), text: str(500), done: bool, deleted: bool, added: str(40), doneAt: str(40), deletedAt: str(40) };
const TILE = { name: str(40), collapsed: bool };
const isId = str(100);

// Creates the item if it's new (only with its required field), else changes just the fields named.
// Changing an item someone else removed does nothing: removing wins.
function upsert(list, op, fields, required) {
  if (!isId(op.id)) return;
  const set = Object.entries(op.set ?? {}).filter(([k, v]) => Object.hasOwn(fields, k) && fields[k](v));
  let item = list.find((x) => x.id === op.id);
  if (!item) {
    if (!set.some(([k]) => k === required)) return;
    item = { id: op.id };
    list.push(item);
  }
  for (const [k, v] of set) item[k] = v;
  for (const k of Array.isArray(op.unset) ? op.unset : []) if (Object.hasOwn(fields, k) && k !== required) delete item[k];
}

export function apply(s, op) {
  if (op?.op === 'task') upsert(s.tasks, op, TASK, 'text');
  else if (op?.op === 'tile') upsert(s.tiles, op, TILE, 'name');
  else if (op?.op === 'task-del') s.tasks = s.tasks.filter((t) => t.id !== op.id);
  else if (op?.op === 'tile-del') s.tiles = s.tiles.filter((t) => t.id !== op.id); // its tasks go by their own task-del
  else if (op?.op === 'order' && Array.isArray(op.ids)) {
    // Tiles this device didn't know about keep their place at the end.
    const at = (id) => (op.ids.includes(id) ? op.ids.indexOf(id) : Infinity);
    s.tiles.sort((a, b) => at(a.id) - at(b.id));
  }
}

// --- The page: the extension's panel.html. With no chrome.storage here, panel.js keeps the list on
// this server through sync.js. Plus what a phone needs: the screen width, and the manifest and icon
// for "Add to Home Screen". ---
const page = readFileSync(join(root, 'panel.html'), 'utf8')
  .replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icons/app-180.png">'
    + '<meta name="theme-color" content="#282828">');
if (!page.includes('viewport')) throw new Error("couldn't add the phone tags to panel.html");
const files = {
  '/': ['text/html', page],
  '/panel.css': ['text/css', 'panel.css'],
  '/panel.js': ['text/javascript', 'panel.js'],
  '/prefs.js': ['text/javascript', 'prefs.js'],
  '/sync.js': ['text/javascript', 'sync.js'],
  '/sw.js': ['text/javascript', 'server/sw.js'],
  ...Object.fromEntries([16, 32, 48, 128].map((n) => [`/icons/icon-${n}.png`, ['image/png', `icons/icon-${n}.png`]])),
  '/favicon.ico': ['image/png', 'icons/icon-32.png'],
  '/manifest.webmanifest': ['application/manifest+json', 'server/manifest.webmanifest'],
  ...Object.fromEntries([180, 192, 512].map((n) => [`/icons/app-${n}.png`, ['image/png', `icons/app-${n}.png`]])),
};
for (const [path, [type, src]] of Object.entries(files)) files[path] = [type, path === '/' ? src : readFileSync(join(root, src))];

const hash = (s) => createHash('sha256').update(s).digest();
const allowed = (req) => {
  if (!PASSWORD) return true;
  const given = Buffer.from((req.headers.authorization ?? '').replace(/^Basic /, ''), 'base64').toString();
  return timingSafeEqual(hash(given.slice(given.indexOf(':') + 1)), hash(PASSWORD));
};
const MAX_BODY = 1_000_000;

export const server = createServer(async (req, res) => {
  const send = (code, type, body, headers = {}) => {
    res.writeHead(code, {
      'Content-Type': type,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      ...headers,
    });
    res.end(body);
  };
  const url = new URL(req.url, 'http://x');
  // The page asks the browser for the password (it shows a login box). The list itself just says no,
  // so a wrong password typed into the extension's prefs doesn't pop up a login box too.
  const ask = url.pathname.startsWith('/api/') ? {} : { 'WWW-Authenticate': 'Basic realm="tascii"' };
  if (!allowed(req)) return send(401, 'text/plain', 'password needed', ask);

  if (req.method === 'GET' && url.pathname === '/api/state') {
    if (url.searchParams.get('since') === String(state.rev)) return send(204, 'text/plain', '');
    return send(200, 'application/json', JSON.stringify(state));
  }
  if (req.method === 'POST' && url.pathname === '/api/ops') {
    // JSON only: a web page on another site can't send that without asking first, so it can't edit your list.
    if (req.headers['content-type'] !== 'application/json') return send(415, 'text/plain', 'JSON only');
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > MAX_BODY) return send(413, 'text/plain', 'too big');
    }
    let ops;
    try { ops = JSON.parse(body); } catch { return send(400, 'text/plain', 'bad JSON'); }
    if (!Array.isArray(ops)) return send(400, 'text/plain', 'expected a list of changes');
    ops.forEach((op) => apply(state, op)); // bad changes are skipped; the reply shows what the server kept
    save();
    return send(200, 'application/json', JSON.stringify(state));
  }
  const file = req.method === 'GET' && files[url.pathname];
  if (file) return send(200, ...file);
  send(404, 'text/plain', 'not found');
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => console.log(`tascii on port ${PORT}, list saved in ${DATA}${PASSWORD ? ', password on' : ''}`));
}
