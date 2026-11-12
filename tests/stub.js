// Stands in for Chrome's extension APIs when panel.html runs as a plain page in tests.
// Storage lives in memory and fires onChanged like the real thing.
const presets = {
  '': [{ id: 'a', text: 'old task', done: false, added: '' }],
  // Junk a broken older version, a bug, or a hand edit could leave in storage.
  '#corrupt': [
    null, 5, 'str',
    { id: 7, text: 'number id' },
    { id: 'n', text: { evil: 1 } },
    { id: 'q"]', text: 'quote id', done: false },
    { id: 'd', text: 'bad date', done: true, doneAt: 'not a date' },
    { id: 'ok', text: 'valid', done: 'yes' },
  ],
};
window.__store = { tasks: structuredClone(presets[location.hash]) };
window.__errors = [];
addEventListener('error', (e) => __errors.push(e.message));
addEventListener('unhandledrejection', (e) => __errors.push(String(e.reason)));

const listeners = [];
window.__fire = (newValue) => listeners.forEach((f) => f({ tasks: { newValue } }, 'local'));
window.chrome = {
  storage: {
    local: {
      get: async (defaults) => ({ ...defaults, ...structuredClone(__store) }),
      set: async (o) => {
        __store = structuredClone(o);
        __fire(structuredClone(o.tasks));
      },
    },
    onChanged: { addListener: (f) => listeners.push(f) },
  },
};
