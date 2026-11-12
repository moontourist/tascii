const input = document.getElementById('new');
const list = document.getElementById('list');
const row = document.getElementById('row').content.firstElementChild;
let tasks = [];

const save = () => chrome.storage.local.set({ tasks });

function render() {
  list.replaceChildren(...tasks.map((t) => {
    const li = row.cloneNode(true);
    li.dataset.id = t.id;
    li.classList.toggle('done', t.done);
    const box = li.querySelector('.box');
    box.textContent = t.done ? '[x]' : '[ ]';
    box.setAttribute('aria-label', t.done ? 'Mark not done' : 'Mark done');
    li.querySelector('.text').textContent = t.text; // textContent, never innerHTML: user text stays text
    return li;
  }));
}

const loaded = chrome.storage.local.get({ tasks: [] }).then((r) => {
  tasks = r.tasks;
  render();
});

input.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter' || e.isComposing) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await loaded; // don't save over the stored list before it has been read
  tasks.push({ id: crypto.randomUUID(), text, done: false, added: new Date().toISOString() });
  save();
  render();
});
