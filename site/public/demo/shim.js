// Stands in for chrome.storage so the real panel can run on the website as a demo.
// Tasks are kept in this browser's localStorage under 'tascii-demo'. Nothing is sent anywhere.
{
  const KEY = 'tascii-demo';
  const now = new Date().toISOString();
  const seed = {
    tiles: [{ id: 'main', name: 'try me', collapsed: false }, { id: 'later', name: 'later', collapsed: false }],
    tasks: [
      { id: 'd1', tile: 'main', text: 'cross me off: click the box', done: false, added: now },
      { id: 'd2', tile: 'main', text: 'click these words to edit them', done: false, added: now },
      { id: 'd3', tile: 'main', text: 'press x to delete, then u to undo', done: false, added: now },
      { id: 'd4', tile: 'later', text: 'add tascii to Chrome', done: false, added: now },
      { id: 'd5', tile: 'later', text: 'make a new tile with [ + tile ]', done: true, doneAt: now, added: now },
    ],
  };
  let store;
  try { store = JSON.parse(localStorage.getItem(KEY)); } catch {} // blocked or junk: start fresh
  if (!store || typeof store !== 'object') store = seed;
  const listeners = [];
  window.chrome = {
    storage: {
      local: {
        get: async (defaults) => ({ ...defaults, ...structuredClone(store) }),
        set: async (o) => {
          Object.assign(store, structuredClone(o));
          try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {} // full or blocked: keep it in memory
          const changes = Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { newValue: structuredClone(v) }]));
          listeners.forEach((f) => f(changes, 'local'));
        },
      },
      onChanged: { addListener: (f) => listeners.push(f) },
    },
  };
}
