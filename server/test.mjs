// Checks the home server and its sync. Run from the repo root: node server/test.mjs
// Two fake devices run the real client.js against the real server, on a throwaway list.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = mkdtempSync(join(tmpdir(), 'tascii-server-'));
process.env.TASCII_DATA = join(dir, 'tascii.json');
process.env.TASCII_PASSWORD = 'pw';
const { server } = await import('./server.mjs');
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/`;
const auth = { Authorization: `Basic ${btoa('me:pw')}` };

const failed = [];
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failed.push(name);
};

// A device: sync.js in its own sandbox, like the server's page (address '' is the page's own server).
// `up` false makes its network fail.
const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'sync.js'), 'utf8');
function device() {
  const d = { up: true, events: {}, classes: new Set(), seen: [] };
  const window = {
    fetch: (u, o) => (d.up ? fetch(u.startsWith('http') ? u : base + u, o) : Promise.reject(new Error('no signal'))),
    btoa,
    setInterval: () => {}, // polls run by hand below
    setTimeout,
    structuredClone,
    crypto: { getRandomValues: (a) => crypto.getRandomValues(a) }, // like a plain-http page: no randomUUID
    addEventListener: (name, f) => { d.events[name] = f; },
    document: {
      hidden: false,
      addEventListener: () => {},
      getElementById: () => null,
      documentElement: { classList: { toggle: (c, on) => (on ? d.classes.add(c) : d.classes.delete(c)) } },
    },
  };
  window.window = window;
  vm.runInNewContext(src, window);
  const storage = window.serverStorage('', 'pw');
  d.store = storage.local;
  storage.onChanged.addListener((c) => d.seen.push(c));
  d.sync = window; // checkServer and uploadList
  d.poll = () => d.events.focus();
  d.uuid = () => window.crypto.randomUUID();
  return d;
}

// Auth and the cross-site guard.
const page401 = await fetch(base);
const api401 = await fetch(`${base}api/state`);
check('no password: refused, and the page asks for it', page401.status === 401 && page401.headers.has('www-authenticate'));
check("no password: the list refuses without popping up a login box", api401.status === 401 && !api401.headers.has('www-authenticate'));
check('right password: page served with sync.js', (await (await fetch(base, { headers: auth })).text()).includes('sync.js'));
// Add to Home Screen: the page links the manifest and icon, and every icon it names is served.
const html = await (await fetch(base, { headers: auth })).text();
const manifest = await (await fetch(`${base}manifest.webmanifest`, { headers: auth })).json();
const icons = await Promise.all([...manifest.icons.map((i) => i.src), 'icons/app-180.png'].map((src) => fetch(base + src, { headers: auth })));
check('home screen: page links the manifest, icon and phone width', ['rel="manifest"', 'rel="apple-touch-icon"', 'name="viewport"'].every((s) => html.includes(s)));
check('home screen: manifest opens full screen, every icon is served', manifest.display === 'standalone'
  && icons.every((r) => r.status === 200 && r.headers.get('content-type') === 'image/png'));
const form = await fetch(`${base}api/ops`, { method: 'POST', headers: { ...auth, 'Content-Type': 'text/plain' }, body: '[]' });
check('non-JSON post (another site trying to edit): refused', form.status === 415);

// The race from the plan: both devices load the same list, then edit before hearing from each other.
const laptop = device();
const phone = device();
// Connecting from the extension: checks before switching, then copying a list to an empty server.
const { checkServer, uploadList } = laptop.sync;
check('connect: wrong password caught', (await checkServer(base, 'nope')).status === 'password');
check('connect: no server there caught', (await checkServer('http://localhost:1', 'pw')).status === 'unreachable');
check('connect: right password sees an empty list', (await checkServer(base, 'pw')).list?.tasks.length === 0);
const local = { tiles: [{ id: 'L', name: 'local', collapsed: false }], tasks: [{ id: 'l1', tile: 'L', text: 'from this browser', done: false }] };
check('connect: a local list copies to an empty server', await uploadList(base, 'pw', local.tasks, local.tiles)
  && (await checkServer(base, 'pw')).list.tasks[0]?.text === 'from this browser');
await fetch(`${base}api/ops`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify([{ op: 'task-del', id: 'l1' }, { op: 'tile-del', id: 'L' }]) }); // empty again for the race below
const ids = new Set(Array.from({ length: 50 }, laptop.uuid));
check('plain http: new ids still work (randomUUID filled in)', ids.size === 50 && [...ids].every((u) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(u)));
const empty = await laptop.store.get({ tasks: [], tiles: [] });
const tile = { id: 'g', name: 'groceries', collapsed: false };
await laptop.store.set({ tasks: [{ id: 'milk', tile: 'g', text: 'milk', done: false }], tiles: [tile] });
const start = await phone.store.get({});
check('a fresh server starts empty', empty.tasks.length === 0);
check('the phone loads what the laptop saved', start.tasks[0]?.text === 'milk');

await laptop.store.set({ tasks: [...start.tasks, { id: 'eggs', tile: 'g', text: 'eggs', done: false }], tiles: [tile] });
await phone.store.set({ tasks: [{ ...start.tasks[0], done: true }], tiles: [tile] }); // hasn't heard about eggs
let s = await (await fetch(`${base}api/state`, { headers: auth })).json();
check('both edits survive: milk done and eggs added', s.tasks.find((t) => t.id === 'milk')?.done === true && s.tasks.some((t) => t.id === 'eggs'));
check('the phone sees eggs straight after its own save', phone.seen.at(-1)?.tasks.newValue.some((t) => t.id === 'eggs'));
await laptop.poll();
check('the laptop sees milk done on its next check', laptop.seen.at(-1)?.tasks.newValue.find((t) => t.id === 'milk')?.done === true);

// No signal: the change waits, "offline" shows, and it goes through when the signal is back.
const now = structuredClone(phone.seen.at(-1).tasks.newValue);
phone.up = false;
await phone.store.set({ tasks: now.filter((t) => t.id !== 'eggs'), tiles: [tile] });
check('no signal: offline shows', phone.classes.has('offline'));
phone.up = true;
await phone.poll();
s = await (await fetch(`${base}api/state`, { headers: auth })).json();
check('signal back: the waiting change goes through and offline clears', !s.tasks.some((t) => t.id === 'eggs') && !phone.classes.has('offline'));

// Bad changes are skipped, good ones in the same batch still land.
const bad = [null, { op: 'task', id: 'x', set: { done: true } }, { op: 'task', id: 5, set: { text: 'n' } },
  { op: 'task', id: 'big', set: { text: 'a'.repeat(501) } }, { op: 'task', id: 'milk', set: { evil: 1, text: 7 } },
  { op: 'task', id: 'ok', set: { text: 'bread', tile: 'g' } }];
s = await (await fetch(`${base}api/ops`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(bad) })).json();
check('bad changes skipped, the good one kept', s.tasks.map((t) => t.id).join() === 'milk,ok' && !('evil' in s.tasks[0]) && s.tasks[0].text === 'milk');
check('saved to disk', JSON.parse(readFileSync(process.env.TASCII_DATA, 'utf8')).rev === s.rev);

server.close();
rmSync(dir, { recursive: true, force: true });
console.log(failed.length ? `\n${failed.length} failed` : '\nall passed');
process.exit(failed.length ? 1 : 0);
