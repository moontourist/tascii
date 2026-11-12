const tilesEl = document.getElementById('tiles');
const addTileBtn = document.getElementById('add-tile');
const prefsBtn = document.getElementById('prefs-btn');
const prefsBox = document.getElementById('prefs');
const sizeOut = document.getElementById('size-out');
const tileTpl = document.getElementById('tile').content.firstElementChild;
const row = document.getElementById('row').content.firstElementChild;
const today = document.getElementById('today');
const progress = document.getElementById('progress');
const fill = document.getElementById('fill');
const rest = document.getElementById('rest');
const tally = document.getElementById('tally');
const calm = matchMedia('(prefers-reduced-motion: reduce)');
let tasks = [];
let tiles = []; // in screen order: { id, name, collapsed }
let fresh = null; // id of the task or tile just added, so it can slide in
const tileEls = new Map(); // tile id -> its <section>, kept between renders so typing and focus survive
const undo = []; // deletions since the panel opened, newest last (u takes them back)

const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const shortFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const dayKey = (d) => (isNaN(d) ? '' : d.toLocaleDateString('en-CA')); // "2026-11-12"
function showDate() {
  const d = new Date();
  const changed = today.dateTime && today.dateTime !== dayKey(d);
  today.textContent = dayFmt.format(d).toLowerCase(); // "thu 12 nov"
  today.dateTime = dayKey(d);
  if (changed) render(); // new day: today's progress starts over
}
showDate();
setInterval(showDate, 60_000); // a minute check survives the computer sleeping past midnight

const save = () => chrome.storage.local.set({ tasks, tiles });

// Stored data could come from an older version, a bug, or a hand edit, so check its shape.
// Tasks from before tiles existed (or whose tile is gone) land in the first tile.
const listOf = (v) => (Array.isArray(v) ? v : []);
function clean(rawTasks, rawTiles) {
  const ts = listOf(rawTiles)
    .filter((t, i, all) => typeof t?.id === 'string' && typeof t.name === 'string' && all.findIndex((x) => x?.id === t.id) === i)
    .map((t) => ({ id: t.id, name: t.name.slice(0, 40), collapsed: t.collapsed === true }));
  if (!ts.length) ts.push({ id: 'main', name: 'todo', collapsed: false });
  const ids = new Set(ts.map((t) => t.id));
  const tk = listOf(rawTasks)
    .filter((t) => typeof t?.id === 'string' && typeof t.text === 'string')
    .map((t) => ({ ...t, done: t.done === true, deleted: t.deleted === true, tile: ids.has(t.tile) ? t.tile : ts[0].id }));
  return [tk, ts];
}

function rowFor(t) {
  const li = row.cloneNode(true);
  li.dataset.id = t.id;
  li.classList.toggle('done', t.done || t.deleted); // both live in history
  li.classList.toggle('deleted', t.deleted);
  li.classList.toggle('fresh', t.id === fresh);
  li.querySelector('.box').textContent = t.deleted ? '[-]' : t.done ? '[x]' : '[ ]';
  li.querySelector('.task').setAttribute('aria-pressed', t.done);
  if (t.deleted) li.querySelector('.task').setAttribute('aria-label', `Deleted: ${t.text}. Restore`);
  li.querySelector('.label').textContent = t.text; // textContent, never innerHTML: user text stays text
  const when = new Date(ended(t));
  if (ended(t) && !isNaN(when)) li.querySelector('.when').textContent = shortFmt.format(when).toLowerCase();
  return li;
}

// History holds finished and deleted tasks, newest first.
const ended = (t) => (t.done ? t.doneAt : t.deletedAt) ?? '';
const inHistory = (t) => t.done || t.deleted;

function fillTile(el, tile) {
  const mine = tasks.filter((t) => t.tile === tile.id);
  const open = mine.filter((t) => !inHistory(t));
  const done = mine.filter(inHistory).sort((x, y) => ended(y).localeCompare(ended(x)));
  el.classList.toggle('collapsed', tile.collapsed);
  el.classList.toggle('fresh', tile.id === fresh);
  const fold = el.querySelector('.fold');
  fold.textContent = tile.collapsed ? '+' : '-';
  fold.setAttribute('aria-label', `${tile.collapsed ? 'Expand' : 'Collapse'} ${tile.name}`);
  const title = el.querySelector('.title');
  if (document.activeElement !== title) title.value = tile.name; // .value, so a name can't become HTML
  el.querySelector('.n').textContent = open.length || '';
  el.querySelector('.open').replaceChildren(...open.map(rowFor));
  el.querySelector('.done').replaceChildren(...done.map(rowFor));
  el.querySelector('.empty').hidden = open.length > 0;
  el.querySelector('.history').hidden = done.length === 0;
  el.querySelector('.count').textContent = done.length;
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
  // A task being edited is rebuilt too: reopen it with what was typed so far.
  const editing = a?.matches('.edit') && { id: li.dataset.id, value: a.value, sel: [a.selectionStart, a.selectionEnd] };

  tiles.forEach((tile, i) => {
    let el = tileEls.get(tile.id);
    if (!el) {
      el = tileTpl.cloneNode(true);
      el.dataset.id = tile.id;
      tileEls.set(tile.id, el);
    }
    if (tilesEl.children[i] !== el) tilesEl.insertBefore(el, tilesEl.children[i] ?? null);
    fillTile(el, tile);
  });
  for (const [id, el] of tileEls) {
    if (!tiles.some((t) => t.id === id)) {
      el.remove();
      tileEls.delete(id);
    }
  }
  tilesEl.classList.toggle('only', tiles.length === 1);

  const open = tasks.filter((t) => !inHistory(t)).length;
  const doneToday = tasks.filter((t) => t.done && dayKey(new Date(t.doneAt)) === today.dateTime).length;
  drawBar(doneToday, open + doneToday);

  // Moving a tile in the page drops focus, so put it back.
  if (a && a !== document.activeElement && a.isConnected) a.focus();
  // Same row if it's still in the same list, else its neighbour, else that tile's input.
  if (!was || document.activeElement !== document.body) return;
  const find = (id) => [...was.ul.children].find((x) => x.dataset.id === id)?.querySelector(was.part);
  const fallback = was.ul.isConnected ? was.ul.closest('.tile').querySelector('.new') : firstInput();
  (find(was.id) ?? find(was.near) ?? fallback)?.focus();
  if (editing) {
    const row = find(editing.id)?.closest('li');
    if (row) startEdit(row, editing);
  }
}

// Editing a task's words in place: Enter or clicking away saves, Esc cancels.
// `from` is the click (to put the cursor where it landed) or { value, sel } when reopening after a redraw.
function startEdit(li, from = {}) {
  const t = tasks.find((x) => x.id === li.dataset.id);
  if (!t || inHistory(t) || li.classList.contains('leaving') || li.querySelector('.edit')) return;
  const input = document.createElement('input');
  input.className = 'edit';
  input.maxLength = 500;
  input.autocomplete = 'off';
  input.spellcheck = true; // underline the misspelling you came to fix
  input.setAttribute('aria-label', 'Edit task');
  input.value = from.value ?? t.text;
  const hit = from.clientX !== undefined && document.caretPositionFromPoint?.(from.clientX, from.clientY);
  const at = hit && li.querySelector('.label').contains(hit.offsetNode) ? hit.offset : input.value.length;
  li.classList.add('editing');
  li.querySelector('.task').after(input);
  input.focus();
  input.setSelectionRange(...(from.sel ?? [at, at]));
  let finished = false;
  const finish = (keep) => {
    if (finished) return;
    finished = true;
    const text = input.value.trim();
    if (keep && text && text !== t.text) {
      t.text = text;
      save();
    }
    li.querySelector('.label').textContent = t.text;
    li.classList.remove('editing');
    input.remove();
  };
  input.addEventListener('keydown', (e) => {
    if (e.isComposing || (e.key !== 'Enter' && e.key !== 'Escape')) return;
    e.preventDefault();
    e.stopPropagation();
    finish(e.key === 'Enter');
    li.querySelector('.task').focus();
  });
  input.addEventListener('blur', () => finish(true));
}

const firstInput = () => tilesEl.querySelector('.new');

// ASCII bar of tasks finished today. Grows one # at a time when it goes up.
const BAR = 16; // fits beside "3/6 today" in a narrow panel, even with a scrollbar
let shown = -1; // bar chars on screen; -1 until the first draw, which is instant
let growing;
function drawBar(n, total) {
  progress.hidden = total === 0;
  tally.textContent = `${n}/${total} today`;
  const target = total ? Math.round((n / total) * BAR) : 0;
  const paint = () => {
    fill.textContent = '#'.repeat(shown);
    rest.textContent = '-'.repeat(BAR - shown);
  };
  clearInterval(growing);
  if (shown < 0 || target <= shown || calm.matches) {
    shown = target;
    paint();
    return;
  }
  growing = setInterval(() => {
    shown++;
    paint();
    if (shown >= target) clearInterval(growing);
  }, 25);
}

chrome.storage.local.get({ tasks: [], tiles: [] }).then((r) => {
  [tasks, tiles] = clean(r.tasks, r.tiles);
  render();
  // Open ready for hjkl on the first task. With no tasks, open ready to type.
  if (document.activeElement === document.body) (stops().find((el) => el.matches('.task')) ?? firstInput())?.focus();
});

// Keys only reach the panel while it has focus (clicking the web page takes it away).
// Show that like an inactive window: dim title, plain borders, and a hint to click.
const showFocus = () => document.documentElement.classList.toggle('away', !document.hasFocus());
addEventListener('focus', showFocus);
addEventListener('blur', showFocus);
showFocus();

// A panel open in another window changed something: show its version.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !(changes.tasks || changes.tiles)) return;
  const next = clean(changes.tasks ? changes.tasks.newValue : tasks, changes.tiles ? changes.tiles.newValue : tiles);
  if (JSON.stringify(next) === JSON.stringify(clean(tasks, tiles))) return; // our own save
  [tasks, tiles] = next;
  render();
});

const tileFor = (el) => tiles.find((t) => t.id === el?.closest('.tile')?.dataset.id);

// Enter in a task input adds the task. Enter in a tile name keeps the name and moves on.
tilesEl.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.isComposing) return;
  const el = e.target.closest('.tile');
  if (e.target.matches('.title')) {
    el.querySelector('.new').focus(); // leaving the name field saves it (see 'change')
    return;
  }
  if (!e.target.matches('.new')) return;
  const text = e.target.value.trim();
  if (!text) return;
  e.target.value = '';
  fresh = crypto.randomUUID();
  tasks.push({ id: fresh, tile: el.dataset.id, text, done: false, deleted: false, added: new Date().toISOString() });
  save();
  render();
  fresh = null;
});

tilesEl.addEventListener('change', (e) => {
  const tile = e.target.matches('.title') && tileFor(e.target);
  if (!tile) return;
  tile.name = e.target.value.trim().slice(0, 40) || 'untitled';
  e.target.value = tile.name;
  save();
  render();
});

tilesEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  const tile = tileFor(btn);
  if (!tile) return;
  if (btn.matches('.fold')) {
    tile.collapsed = !tile.collapsed;
    save();
    render();
  } else if (btn.matches('.close')) {
    closeTile(btn, tile);
  } else if (e.target.closest('.label') && btn.closest('.open')) {
    startEdit(btn.closest('li'), e); // the words: edit them
  } else {
    onRowClick(btn); // the box or the space around it: cross off
  }
});

function addTile() {
  const id = crypto.randomUUID();
  tiles.push({ id, name: 'untitled', collapsed: false });
  fresh = id;
  save();
  render();
  fresh = null;
  const title = tileEls.get(id).querySelector('.title');
  title.focus();
  title.select(); // type a name straight away
}
addTileBtn.addEventListener('click', addTile);

// A tile with tasks asks first: the x turns into "del 3?" for a few seconds.
async function closeTile(btn, tile) {
  if (tiles.length === 1) return;
  const count = tasks.filter((t) => t.tile === tile.id).length;
  if (count && !btn.classList.contains('confirm')) {
    btn.classList.add('confirm');
    btn.textContent = `del ${count}?`;
    setTimeout(() => {
      btn.classList.remove('confirm');
      btn.textContent = 'x';
    }, 3000);
    return;
  }
  undo.push({ tile, at: tiles.indexOf(tile), tasks: tasks.filter((t) => t.tile === tile.id) });
  tiles = tiles.filter((t) => t !== tile);
  tasks = tasks.filter((t) => t.tile !== tile.id);
  save();
  if (!calm.matches) {
    tileEls.get(tile.id).classList.add('gone');
    await wait(200);
  }
  render();
}

// Slide the other tiles to their new places instead of jumping (the FLIP trick:
// measure, change, then animate from the old spot to the new one).
function flip(change) {
  const els = [...tilesEl.children];
  const before = new Map(els.map((el) => [el, el.getBoundingClientRect().top]));
  change();
  if (calm.matches) return;
  for (const el of els) {
    const dy = before.get(el) - el.getBoundingClientRect().top;
    if (dy) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 180, easing: 'ease-out' });
  }
}

function moveTile(tile, by) {
  const from = tiles.indexOf(tile);
  const to = from + by;
  if (to < 0 || to >= tiles.length) return;
  tiles.splice(to, 0, ...tiles.splice(from, 1));
  save();
  flip(render);
}

// Drag a tile by its bar. It only counts as a drag after the pointer moves a few
// pixels, so plain clicks on the name and the -/+ still work.
let justDragged = false;
addEventListener('click', (e) => {
  if (justDragged) {
    e.stopPropagation();
    e.preventDefault();
  }
}, true);
tilesEl.addEventListener('pointerdown', (e) => {
  const bar = e.target.closest('.bar');
  if (!bar || e.button !== 0 || e.target.closest('.close')) return;
  const el = bar.parentElement;
  const startY = e.clientY;
  let dragging = false;
  const move = (ev) => {
    if (!dragging) {
      if (Math.abs(ev.clientY - startY) < 6) return;
      dragging = true;
      el.classList.add('dragging');
      getSelection().removeAllRanges();
    }
    const y = ev.clientY + scrollY;
    const others = [...tilesEl.children].filter((x) => x !== el);
    const next = others.find((x) => y < x.offsetTop + x.offsetHeight / 2) ?? null;
    if (next !== el.nextElementSibling) flip(() => tilesEl.insertBefore(el, next));
  };
  const up = () => {
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', up);
    if (!dragging) return;
    el.classList.remove('dragging');
    justDragged = true; // swallow the click that follows letting go
    setTimeout(() => { justDragged = false; }, 0);
    const order = [...tilesEl.children].map((x) => x.dataset.id);
    tiles.sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id));
    save();
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SPIN = ['[-]', '[\\]', '[|]', '[/]', '[x]'];
const UNSPIN = ['[/]', '[|]', '[\\]', '[-]', '[ ]'];
async function spin(box, frames) {
  for (const f of frames) {
    box.textContent = f;
    await wait(45);
  }
}

// A little burst of ASCII sparks flying out of the box.
const SPARKS = ['*', '+', '.', "'", '*', '+', '.', '`'];
const SPARK_COLORS = ['var(--accent)', 'var(--ok)', 'var(--info)', 'var(--text)'];
function burst(box) {
  const r = box.getBoundingClientRect();
  SPARKS.forEach((ch, i) => {
    const s = document.createElement('span');
    s.className = 'spark';
    s.textContent = ch;
    s.style.left = `${r.left + r.width / 2}px`;
    s.style.top = `${r.top + r.height / 2}px`;
    s.style.color = SPARK_COLORS[i % SPARK_COLORS.length];
    document.body.append(s);
    const angle = (i / SPARKS.length) * 2 * Math.PI + Math.random() * 0.6;
    const dist = 22 + Math.random() * 18;
    const out = `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px))`;
    s.animate([
      { transform: 'translate(-50%, -50%) scale(1.4)', opacity: 1 },
      { transform: `${out} scale(1)`, opacity: 1, offset: 0.6 },
      { transform: `${out} scale(0.6)`, opacity: 0 },
    ], { duration: 450, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'forwards' });
    setTimeout(() => s.remove(), 500); // a timer, not the animation's finish event, which can stall in a hidden panel
  });
}

async function onRowClick(btn) {
  const li = btn.closest('li');
  if (!li || li.classList.contains('leaving')) return;
  const t = tasks.find((t) => t.id === li.dataset.id);
  if (!t) return;
  // x on a task sends it to history; x in history removes it for good.
  const kind = btn.matches('.del') ? (inHistory(t) ? 'gone' : 'deleted') : inHistory(t) ? 'restored' : 'finished';
  if (kind === 'gone') {
    undo.push({ task: t, at: tasks.indexOf(t) });
    tasks = tasks.filter((x) => x !== t);
  } else if (kind === 'deleted') {
    undo.push({ id: t.id });
    t.deleted = true;
    t.deletedAt = new Date().toISOString();
  } else if (kind === 'restored') {
    t.done = false;
    t.deleted = false;
    delete t.doneAt;
    delete t.deletedAt;
  } else {
    t.done = true;
    t.doneAt = new Date().toISOString();
  }
  save(); // saved before the animation, so closing the panel mid-way loses nothing
  if (!calm.matches) {
    li.classList.add('leaving', kind === 'deleted' ? 'gone' : kind);
    const box = li.querySelector('.box');
    if (kind === 'finished') {
      await spin(box, SPIN);
      burst(box);
      await wait(430); // matches the strike and fade timings in panel.css
    } else if (kind === 'restored') {
      await spin(box, UNSPIN);
      await wait(180);
    } else {
      await wait(200);
    }
  }
  render();
}

// u: take back the newest deletion, whether it sent a task to history,
// removed one from history for good, or deleted a whole tile.
function undoLast() {
  const u = undo.pop();
  if (!u) return;
  let t;
  if (u.id) {
    t = tasks.find((x) => x.id === u.id);
    if (!t?.deleted) return undoLast(); // already restored by hand, or gone: try the one before
    t.deleted = false;
    delete t.deletedAt;
  } else if (u.task) {
    t = u.task;
    if (!tiles.some((x) => x.id === t.tile)) t.tile = tiles[0].id;
    tasks.splice(Math.min(u.at, tasks.length), 0, t);
  } else {
    tiles.splice(Math.min(u.at, tiles.length), 0, u.tile);
    tasks.push(...u.tasks.filter((x) => !tasks.some((y) => y.id === x.id)));
  }
  fresh = t?.id ?? u.tile.id;
  save();
  render();
  fresh = null;
  if (!t) return tileEls.get(u.tile.id)?.querySelector('.fold').focus();
  const li = tilesEl.querySelector(`li[data-id="${CSS.escape(t.id)}"]`);
  if (inHistory(t)) li?.closest('details').setAttribute('open', '');
  li?.querySelector('.task').focus();
}

// Prefs: theme and text size (the values live in prefs.js).
function savePrefs() {
  try {
    localStorage.setItem('prefs', JSON.stringify(prefs));
  } catch {} // can't save: still applies until the panel closes
  applyPrefs();
  showPrefs();
}
function showPrefs() {
  prefsBox.querySelector(`input[value="${prefs.theme}"]`).checked = true;
  sizeOut.textContent = `${prefs.size}px`;
  document.getElementById('smaller').disabled = prefs.size === SIZES[0];
  document.getElementById('bigger').disabled = prefs.size === SIZES.at(-1);
}
function resize(by) {
  prefs.size = SIZES[Math.min(SIZES.length - 1, Math.max(0, SIZES.indexOf(prefs.size) + by))];
  savePrefs();
}
function togglePrefs(open = prefsBox.hidden) {
  prefsBox.hidden = !open;
  prefsBtn.setAttribute('aria-expanded', open);
  if (open) {
    showPrefs();
    prefsBox.querySelector('input:checked').focus();
  }
}
prefsBtn.addEventListener('click', () => togglePrefs());
prefsBox.addEventListener('change', (e) => {
  prefs.theme = e.target.value;
  savePrefs();
});
document.getElementById('smaller').addEventListener('click', () => resize(-1));
document.getElementById('bigger').addEventListener('click', () => resize(1));

// Keyboard: j/k (or arrows) move through tile headers, tasks and history toggles.
// h/l move between a task and its x, space crosses off (or restores in history), x deletes (to history), u undoes a deletion, e edits the words,
// i or / goes to the tile's input and Esc leaves it, r renames the tile,
// J/K (or shift+arrows) move the tile, N adds a tile, p opens prefs, +/- change the text size.
const stops = () => [...document.querySelectorAll('.fold, .task, summary')].filter((el) => el.checkVisibility());
const after = (el) => stops().find((s) => el.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING);
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  const a = document.activeElement;
  if (e.key === 'Escape' && a.closest('#prefs')) {
    togglePrefs(false);
    prefsBtn.focus();
    e.preventDefault();
    return;
  }
  const el = a.closest('.tile') ?? tilesEl.firstElementChild;
  if (a.matches('input')) {
    if (e.key === 'Escape' && a.matches('.title')) {
      a.value = tileFor(a)?.name ?? a.value; // undo the edit
      el.querySelector('.fold').focus();
    } else if ((e.key === 'Escape' || e.key === 'ArrowDown') && a.matches('.new')) {
      after(a)?.focus();
    } else return;
    e.preventDefault();
    return;
  }
  const li = a.closest('li');
  const all = stops();
  const at = all.indexOf(li ? li.querySelector('.task') : a);
  const key = e.shiftKey && e.key === 'ArrowDown' ? 'J' : e.shiftKey && e.key === 'ArrowUp' ? 'K' : e.key;
  switch (key) {
    case 'j': case 'ArrowDown': all[at + 1]?.focus(); break;
    case 'k': case 'ArrowUp': (all[at - 1] ?? el?.querySelector('.new'))?.focus(); break;
    case 'h': case 'ArrowLeft': li?.querySelector('.task').focus(); break;
    case 'l': case 'ArrowRight': li?.querySelector('.del').focus(); break;
    case ' ': if (!li) return; li.querySelector('.task').click(); break; // headers and history keep their own space
    case 'x': if (!li) return; li.querySelector('.del').click(); break;
    case 'u': undoLast(); break;
    case 'e': if (!li) return; startEdit(li); break;
    case 'i': case '/': {
      const tile = tileFor(el);
      if (tile?.collapsed) {
        tile.collapsed = false;
        save();
        render();
      }
      el?.querySelector('.new').focus();
      break;
    }
    case 'r': el?.querySelector('.title').focus(); el?.querySelector('.title').select(); break;
    case 'J': case 'K': if (!a.closest('.tile')) return; moveTile(tileFor(a), key === 'J' ? 1 : -1); break;
    case 'N': addTile(); break;
    case 'p': togglePrefs(); break;
    case '+': case '=': resize(1); break;
    case '-': resize(-1); break;
    default: return;
  }
  e.preventDefault();
});
