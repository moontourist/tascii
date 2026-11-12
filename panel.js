const input = document.getElementById('new');
const list = document.getElementById('list');
const empty = document.getElementById('empty');
const row = document.getElementById('row').content.firstElementChild;
const today = document.getElementById('today');
let tasks = [];

const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
function showDate() {
  const d = new Date();
  today.textContent = dayFmt.format(d).toLowerCase(); // "thu 12 nov"
  today.dateTime = d.toLocaleDateString('en-CA'); // "2026-11-12"
}
showDate();
setInterval(showDate, 60_000); // a minute check survives the computer sleeping past midnight

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
  empty.hidden = tasks.length > 0;
}

const loaded = chrome.storage.local.get({ tasks: [] }).then((r) => {
  tasks = r.tasks;
  render();
});

// A panel open in another window changed the list: show its version.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.tasks) return;
  const next = changes.tasks.newValue ?? [];
  if (JSON.stringify(next) === JSON.stringify(tasks)) return; // our own save
  tasks = next;
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

list.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const li = btn.closest('li');
  const id = li.dataset.id;
  let focusId = id;
  if (btn.classList.contains('box')) {
    const t = tasks.find((t) => t.id === id);
    t.done = !t.done;
  } else {
    tasks = tasks.filter((t) => t.id !== id);
    focusId = (li.nextElementSibling ?? li.previousElementSibling)?.dataset.id;
  }
  save();
  render();
  // render() rebuilt the rows, so put keyboard focus back where it was.
  (list.querySelector(`[data-id="${focusId}"] .box`) ?? input).focus();
});
