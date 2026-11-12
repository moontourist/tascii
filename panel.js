const input = document.getElementById('new');
const list = document.getElementById('list');
const empty = document.getElementById('empty');
const historyBox = document.getElementById('history');
const doneList = document.getElementById('done');
const count = document.getElementById('count');
const row = document.getElementById('row').content.firstElementChild;
const today = document.getElementById('today');
const calm = matchMedia('(prefers-reduced-motion: reduce)');
let tasks = [];

const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const shortFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
function showDate() {
  const d = new Date();
  today.textContent = dayFmt.format(d).toLowerCase(); // "thu 12 nov"
  today.dateTime = d.toLocaleDateString('en-CA'); // "2026-11-12"
}
showDate();
setInterval(showDate, 60_000); // a minute check survives the computer sleeping past midnight

const save = () => chrome.storage.local.set({ tasks });

function rowFor(t) {
  const li = row.cloneNode(true);
  li.dataset.id = t.id;
  li.classList.toggle('done', t.done);
  li.querySelector('.box').textContent = t.done ? '[x]' : '[ ]';
  li.querySelector('.task').setAttribute('aria-pressed', t.done);
  li.querySelector('.label').textContent = t.text; // textContent, never innerHTML: user text stays text
  const when = new Date(t.doneAt);
  if (t.doneAt && !isNaN(when)) li.querySelector('.when').textContent = shortFmt.format(when).toLowerCase();
  return li;
}

function render() {
  // Rows are rebuilt below, so remember which one had keyboard focus.
  const a = document.activeElement;
  const li = a?.closest('li');
  const was = li && {
    ul: li.parentElement,
    id: li.dataset.id,
    near: (li.nextElementSibling ?? li.previousElementSibling)?.dataset.id,
    part: a.matches('.del') ? '.del' : '.task',
  };

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done).sort((x, y) => (y.doneAt ?? '').localeCompare(x.doneAt ?? ''));
  list.replaceChildren(...open.map(rowFor));
  doneList.replaceChildren(...done.map(rowFor));
  empty.hidden = open.length > 0;
  historyBox.hidden = done.length === 0;
  count.textContent = done.length;

  // Same row if it's still in the same list, else its neighbour, else the input.
  if (!was) return;
  const find = (id) => [...was.ul.children].find((x) => x.dataset.id === id)?.querySelector(was.part);
  (find(was.id) ?? find(was.near) ?? input).focus();
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

async function onRowClick(e) {
  const btn = e.target.closest('button');
  const li = btn?.closest('li');
  if (!li || li.classList.contains('leaving')) return;
  const t = tasks.find((t) => t.id === li.dataset.id);
  if (!t) return;
  if (btn.matches('.del')) {
    tasks = tasks.filter((x) => x !== t);
  } else if (t.done) { // clicked in history: put it back
    t.done = false;
    delete t.doneAt;
  } else {
    t.done = true;
    t.doneAt = new Date().toISOString();
    save(); // saved before the animation, so closing the panel mid-way loses nothing
    if (!calm.matches) {
      li.classList.add('leaving');
      await new Promise((r) => setTimeout(r, 500)); // matches the 0.3s + 0.2s in panel.css
    }
  }
  save();
  render();
}
list.addEventListener('click', onRowClick);
doneList.addEventListener('click', onRowClick);
