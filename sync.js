// Keeps the list on a tascii home server (see server/) instead of in this browser.
// serverStorage(address, password) works like chrome.storage, so panel.js can use either.
// The server holds the list. Each save from panel.js is turned into small changes against what this
// page last saw ("task 12: done is now true"), so the server can merge edits from several devices.
// Changes from other devices arrive by asking the server every few seconds.
// No connection: "offline" shows by the date, and editing carries on. This device keeps its last copy of the
// list and the changes still waiting, so the page also opens with no signal, and waiting changes go when it's back.
// Used by the server's own page (address '' means the page's own server) and by the extension when
// a server is set in prefs. The website demo loads it but never calls it.

const serverBase = (address) => address && address.replace(/\/*$/, '/'); // '' stays '': this page's own server
const serverAuth = (password) => (password ? { Authorization: `Basic ${btoa(`tascii:${password}`)}` } : {});
const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Changes that turn list `before` into `after`, matched by id.
function listChanges(kind, before, after) {
  const old = new Map(before.map((x) => [x.id, x]));
  const now = new Set(after.map((x) => x.id));
  const ops = [];
  for (const x of after) {
    const o = old.get(x.id) ?? {};
    const set = Object.fromEntries(Object.entries(x).filter(([k, v]) => k !== 'id' && !sameJSON(v, o[k])));
    const unset = Object.keys(o).filter((k) => !(k in x));
    if (Object.keys(set).length || unset.length) ops.push({ op: kind, id: x.id, set, unset });
  }
  for (const id of old.keys()) if (!now.has(id)) ops.push({ op: `${kind}-del`, id });
  return ops;
}

function serverStorage(address, password = '') {
  // Browsers hide crypto.randomUUID (which panel.js uses for new ids) on plain-http pages other than
  // localhost, and a home server on Tailscale or the home network is usually plain http.
  crypto.randomUUID ??= () => '10000000-1000-4000-8000-100000000000'
    .replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
  const POLL = 3000;
  const base = serverBase(address);
  const auth = serverAuth(password);
  let shown = { tasks: [], tiles: [] }; // the list as panel.js last saw it
  let rev = -1; // the server's version number of `shown`
  const queue = []; // changes the server hasn't confirmed yet
  let flushing = null;
  const listeners = [];

  // This device's copy, kept between visits (one per server address). Two tabs offline at once can
  // overwrite each other's waiting changes here, but each still sends its own while it's open.
  const KEEP = `tascii-sync ${base}`;
  let kept = null;
  try { kept = JSON.parse(localStorage.getItem(KEEP)); } catch {} // blocked or junk: start fresh
  if (Array.isArray(kept?.shown?.tasks) && Array.isArray(kept.shown.tiles) && Array.isArray(kept.queue) && Number.isInteger(kept.rev)) {
    ({ shown, rev } = kept);
    queue.push(...kept.queue);
  } else kept = null;
  const keep = () => {
    try { localStorage.setItem(KEEP, JSON.stringify({ shown, rev, queue })); } catch {} // full or blocked: still works while open
  };

  // The server's own page also opens with no signal: sw.js keeps its files (HTTPS pages only).
  if (!address) navigator.serviceWorker?.register('sw.js').catch(() => {});

  const offline = (on) => document.documentElement.classList.toggle('offline', on);

  async function call(path, body) {
    const r = await fetch(base + path, body
      ? { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : { headers: auth });
    if (!r.ok) throw new Error(`server said ${r.status}`);
    offline(false);
    return r.status === 204 ? null : r.json();
  }

  // Take the server's list, unless it's older than ours or we still have changes on the way.
  function take(s) {
    if (!s || s.rev <= rev || queue.length) return;
    rev = s.rev;
    const next = { tasks: s.tasks, tiles: s.tiles };
    if (sameJSON(next, shown)) return keep();
    shown = next;
    keep();
    listeners.forEach((f) => f({ tasks: { newValue: structuredClone(s.tasks) }, tiles: { newValue: structuredClone(s.tiles) } }, 'local'));
  }

  // Send queued changes one batch at a time. On failure they stay queued and go with the next try.
  async function send() {
    try {
      while (queue.length) {
        const batch = queue.slice();
        const s = await call('api/ops', batch);
        queue.splice(0, batch.length);
        keep();
        take(s);
      }
    } catch {
      offline(true);
    }
  }
  // One send at a time. The clearing waits for .finally, which always runs later: with nothing to send,
  // send() is already done before `flushing` is set, and clearing first would leave it set for good.
  function flush() {
    flushing ??= send().finally(() => { flushing = null; });
    return flushing;
  }

  async function poll() {
    if (queue.length) return flush();
    try { take(await call(`api/state?since=${rev}`)); } catch { offline(true); }
  }

  setInterval(poll, POLL);
  addEventListener('focus', poll);
  addEventListener('online', poll);
  document.addEventListener('visibilitychange', () => document.hidden || poll()); // phone unlocked, tab switched back

  return {
    local: {
      // Changes left waiting from last time go first, then the server's list is the truth.
      // No signal: this device's last copy, with its own changes. Never seen the list on this device:
      // wait for the server, however long that takes, since an empty list shouldn't pass for the real one.
      get: async (defaults) => {
        for (;;) {
          await flush();
          try {
            const s = await call('api/state');
            if (!queue.length) {
              [rev, shown] = [s.rev, { tasks: s.tasks, tiles: s.tiles }];
              keep();
            }
            return { ...defaults, ...structuredClone(shown) };
          } catch {
            offline(true);
            if (kept) return { ...defaults, ...structuredClone(shown) };
            await new Promise((r) => setTimeout(r, POLL));
          }
        }
      },
      set: (o) => {
        const next = { ...shown, ...structuredClone(o) }; // a copy: panel.js keeps changing its own
        queue.push(...listChanges('task', shown.tasks, next.tasks), ...listChanges('tile', shown.tiles, next.tiles));
        const order = next.tiles.map((t) => t.id);
        if (!sameJSON(order, shown.tiles.map((t) => t.id))) queue.push({ op: 'order', ids: order });
        shown = next;
        keep();
        return flush();
      },
    },
    onChanged: { addListener: (f) => listeners.push(f) },
  };
}

// Before connecting: can we reach it, and is the password right? Answers 'ok', 'password' or 'unreachable',
// plus the list it holds when it's 'ok'.
async function checkServer(address, password = '') {
  try {
    const r = await fetch(`${serverBase(address)}api/state`, { headers: serverAuth(password) });
    if (r.status === 401) return { status: 'password' };
    if (!r.ok) return { status: 'unreachable' };
    const s = await r.json();
    return Array.isArray(s?.tasks) && Array.isArray(s?.tiles) ? { status: 'ok', list: s } : { status: 'unreachable' };
  } catch {
    return { status: 'unreachable' };
  }
}

// Copy a whole list to an empty server (connecting for the first time). True if the server took it.
async function uploadList(address, password, tasks, tiles) {
  const ops = [...listChanges('tile', [], tiles), ...listChanges('task', [], tasks), { op: 'order', ids: tiles.map((t) => t.id) }];
  try {
    const r = await fetch(`${serverBase(address)}api/ops`, {
      method: 'POST', headers: { ...serverAuth(password), 'Content-Type': 'application/json' }, body: JSON.stringify(ops),
    });
    const s = r.ok && (await r.json());
    return !!s && s.tasks.length >= tasks.length && s.tiles.length >= tiles.length;
  } catch {
    return false;
  }
}
