const tilesEl = document.getElementById('tiles');
const addTileBtn = document.getElementById('add-tile');
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
    .map((t) => ({ ...t, done: t.done === true, tile: ids.has(t.tile) ? t.tile : ts[0].id }));
  return [tk, ts];
}

function rowFor(t) {
  const li = row.cloneNode(true);
  li.dataset.id = t.id;
  li.classList.toggle('done', t.done);
  li.classList.toggle('fresh', t.id === fresh);
  li.querySelector('.box').textContent = t.done ? '[x]' : '[ ]';
  li.querySelector('.task').setAttribute('aria-pressed', t.done);
  li.querySelector('.label').textContent = t.text; // textContent, never innerHTML: user text stays text
  const when = new Date(t.doneAt);
  if (t.doneAt && !isNaN(when)) li.querySelector('.when').textContent = shortFmt.format(when).toLowerCase();
  return li;
}

function fillTile(el, tile) {
  const mine = tasks.filter((t) => t.tile === tile.id);
  const open = mine.filter((t) => !t.done);
  const done = mine.filter((t) => t.done).sort((x, y) => (y.doneAt ?? '').localeCompare(x.doneAt ?? ''));
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

  const open = tasks.filter((t) => !t.done).length;
  const doneToday = tasks.filter((t) => t.done && dayKey(new Date(t.doneAt)) === today.dateTime).length;
  drawBar(doneToday, open + doneToday);

  // Moving a tile in the page drops focus, so put it back.
  if (a && a !== document.activeElement && a.isConnected) a.focus();
  // Same row if it's still in the same list, else its neighbour, else that tile's input.
  if (!was || document.activeElement !== document.body) return;
  const find = (id) => [...was.ul.children].find((x) => x.dataset.id === id)?.querySelector(was.part);
  const fallback = was.ul.isConnected ? was.ul.closest('.tile').querySelector('.new') : firstInput();
  (find(was.id) ?? find(was.near) ?? fallback)?.focus();
}

const firstInput = () => tilesEl.querySelector('.new');

// ASCII bar of tasks finished today. Grows one # at a time when it goes up.
const BAR = 20;
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
  if (document.activeElement === document.body) firstInput()?.focus();
});

// A panel open in another window changed something: show its version.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !(changes.tasks || changes.tiles)) return;
  const next = clean(changes.tasks ? changes.tasks.newValue : tasks, changes.tiles ? changes.tiles.newValue : tiles);
  if (JSON.stringify(next) === JSON.stringify([tasks, tiles])) return; // our own save
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
  tasks.push({ id: fresh, tile: el.dataset.id, text, done: false, added: new Date().toISOString() });
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
  } else {
    onRowClick(btn);
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
const SPARK_COLORS = ['var(--yellow)', 'var(--green)', 'var(--aqua)', 'var(--orange)'];
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
  const kind = btn.matches('.del') ? 'gone' : t.done ? 'restored' : 'finished';
  if (kind === 'gone') {
    tasks = tasks.filter((x) => x !== t);
  } else if (kind === 'restored') {
    t.done = false;
    delete t.doneAt;
  } else {
    t.done = true;
    t.doneAt = new Date().toISOString();
  }
  save(); // saved before the animation, so closing the panel mid-way loses nothing
  if (!calm.matches) {
    li.classList.add('leaving', kind);
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

// Keyboard: j/k (or arrows) move through tile headers, tasks and history toggles.
// h/l move between a task and its x, space crosses off (or restores in history),
// i or / goes to the tile's input and Esc leaves it, r renames the tile,
// J/K (or shift+arrows) move the tile, N adds a tile.
const stops = () => [...document.querySelectorAll('.fold, .task, summary')].filter((el) => el.checkVisibility());
const after = (el) => stops().find((s) => el.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING);
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  const a = document.activeElement;
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
    default: return;
  }
  e.preventDefault();
});
