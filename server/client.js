// Stands in for chrome.storage when the panel is served by the tascii home server.
// The server holds the list. Each save from panel.js is turned into small changes against what this
// page last saw ("task 12: done is now true"), so the server can merge edits from several devices.
// Changes from other devices arrive by asking the server every few seconds.
// No connection: the list dims, "offline" shows by the date, and editing is blocked until the server answers.
{
  // Browsers hide crypto.randomUUID (which panel.js uses for new ids) on plain-http pages other than
  // localhost, and a home server on Tailscale or the home network is usually plain http.
  crypto.randomUUID ??= () => '10000000-1000-4000-8000-100000000000'
    .replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
  const POLL = 3000;
  let shown = { tasks: [], tiles: [] }; // the list as panel.js last saw it
  let rev = -1; // the server's version number of `shown`
  const queue = []; // changes the server hasn't confirmed yet
  let flushing = null;
  const listeners = [];

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // Changes that turn list `before` into `after`, matched by id.
  function changes(kind, before, after) {
    const old = new Map(before.map((x) => [x.id, x]));
    const now = new Set(after.map((x) => x.id));
    const ops = [];
    for (const x of after) {
      const o = old.get(x.id) ?? {};
      const set = Object.fromEntries(Object.entries(x).filter(([k, v]) => k !== 'id' && !same(v, o[k])));
      const unset = Object.keys(o).filter((k) => !(k in x));
      if (Object.keys(set).length || unset.length) ops.push({ op: kind, id: x.id, set, unset });
    }
    for (const id of old.keys()) if (!now.has(id)) ops.push({ op: `${kind}-del`, id });
    return ops;
  }

  function offline(on) {
    document.documentElement.classList.toggle('offline', on);
    for (const id of ['tiles', 'actions']) document.getElementById(id)?.toggleAttribute('inert', on);
  }

  async function call(path, body) {
    const r = await fetch(path, body && { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`server said ${r.status}`);
    offline(false);
    return r.status === 204 ? null : r.json();
  }

  // Take the server's list, unless it's older than ours or we still have changes on the way.
  function take(s) {
    if (!s || s.rev <= rev || queue.length) return;
    rev = s.rev;
    const next = { tasks: s.tasks, tiles: s.tiles };
    if (same(next, shown)) return;
    shown = next;
    listeners.forEach((f) => f({ tasks: { newValue: structuredClone(s.tasks) }, tiles: { newValue: structuredClone(s.tiles) } }, 'local'));
  }

  // Send queued changes one batch at a time. On failure they stay queued and go with the next try.
  function flush() {
    flushing ??= (async () => {
      try {
        while (queue.length) {
          const batch = queue.slice();
          const s = await call('api/ops', batch);
          queue.splice(0, batch.length);
          take(s);
        }
      } catch {
        offline(true);
      } finally {
        flushing = null;
      }
    })();
    return flushing;
  }

  async function poll() {
    if (queue.length) return flush();
    try { take(await call(`api/state?since=${rev}`)); } catch { offline(true); }
  }

  window.chrome = {
    storage: {
      local: {
        // Waits for the server, however long that takes: an empty list shouldn't pass for the real one.
        get: async (defaults) => {
          for (;;) {
            try {
              const s = await call('api/state');
              rev = s.rev;
              shown = { tasks: s.tasks, tiles: s.tiles };
              return { ...defaults, ...structuredClone(shown) };
            } catch {
              offline(true);
              await new Promise((r) => setTimeout(r, POLL));
            }
          }
        },
        set: (o) => {
          const next = { ...shown, ...structuredClone(o) }; // a copy: panel.js keeps changing its own
          queue.push(...changes('task', shown.tasks, next.tasks), ...changes('tile', shown.tiles, next.tiles));
          const order = next.tiles.map((t) => t.id);
          if (!same(order, shown.tiles.map((t) => t.id))) queue.push({ op: 'order', ids: order });
          shown = next;
          return flush();
        },
      },
      onChanged: { addListener: (f) => listeners.push(f) },
    },
  };
  setInterval(poll, POLL);
  addEventListener('focus', poll);
  addEventListener('online', poll);
  document.addEventListener('visibilitychange', () => document.hidden || poll()); // phone unlocked, tab switched back
}
