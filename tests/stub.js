// Stands in for Chrome's extension APIs when panel.html runs as a plain page in tests.
// Storage lives in memory and fires onChanged like the real thing.
const presets = {
  // Saved by a version from before tiles: tasks only.
  '': { tasks: [{ id: 'a', text: 'old task', done: false, added: '' }] },
  // Junk a broken older version, a bug, or a hand edit could leave in storage.
  '#corrupt': {
    tasks: [
      null, 5, 'str',
      { id: 7, text: 'number id' },
      { id: 'n', text: { evil: 1 } },
      { id: 'q"]', text: 'quote id', done: false, tile: 'w' },
      { id: 'd', text: 'bad date', done: true, doneAt: 'not a date', tile: 'w' },
      { id: 'ok', text: 'valid', done: 'yes', tile: 'missing' },
    ],
    tiles: [null, { id: 'w', name: 'work', collapsed: 'yes' }, { id: 'w', name: 'duplicate' }, { id: 5, name: 'bad' }],
  },
};
window.__store = structuredClone(presets[location.hash]);
window.__errors = [];
addEventListener('error', (e) => __errors.push(e.message));
addEventListener('unhandledrejection', (e) => __errors.push(String(e.reason)));

// Headless Chrome here never draws the frame a real view transition waits for,
// so this one applies the change at once and counts it.
window.__wipes = 0;
document.startViewTransition = (update) => {
  __wipes++;
  update();
  return { ready: Promise.resolve() };
};

const listeners = [];
// __fire({ tasks: { newValue } }) pretends another window saved something.
window.__fire = (changes) => listeners.forEach((f) => f(changes, 'local'));
window.chrome = {
  storage: {
    local: {
      get: async (defaults) => ({ ...defaults, ...structuredClone(__store) }),
      set: async (o) => {
        Object.assign(__store, structuredClone(o));
        __fire(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { newValue: structuredClone(v) }])));
      },
    },
    onChanged: { addListener: (f) => listeners.push(f) },
  },
};
