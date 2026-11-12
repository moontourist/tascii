// Runs inside the panel page (see run.mjs). Uses panel.js's globals: tally, fill, rest, wait.
const results = [];
const check = (name, ok) => results.push(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
// Animation lengths in panel.js, plus a margin.
const FINISH = 750; // spin 5 x 45ms + 430ms
const RESTORE = 450; // spin 5 x 45ms + 180ms
const GONE = 250; // 200ms
const allTiles = () => [...document.querySelectorAll('.tile')];
const q = (sel, i = 0) => allTiles()[i]?.querySelector(sel);
const rows = (i = 0, ul = '.open') => [...(q(ul, i)?.children ?? [])];
const texts = (i = 0, ul = '.open') => rows(i, ul).map((li) => li.querySelector('.label').textContent);
const task = (n, i = 0, ul = '.open') => rows(i, ul)[n]?.querySelector('.task');
const names = () => allTiles().map((el) => el.querySelector('.title').value);
const focused = () => document.activeElement;
const type = (v, i = 0) => {
  const input = q('.new', i);
  input.value = v;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
};
const key = (k, extra = {}) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra });
  (focused() ?? document.body).dispatchEvent(e);
  return e;
};
const pointer = (type, el, y) => (el ?? window).dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, clientY: y }));

async function main() {
  await wait(20);
  check('old tasks move into a first tile', names().join() === 'todo' && texts().join() === 'old task');
  check('opens on the first task, ready for hjkl', focused() === task(0));
  check('a single tile has no delete button', getComputedStyle(q('.close')).display === 'none');
  type('second');
  type('   ');
  await wait(20);
  check('Enter adds a task to its tile', texts().join() === 'old task,second' && __store.tasks[1].tile === 'main');
  check('ignores blank input', __store.tasks.length === 2);

  // Security: task text must never turn into HTML or run code.
  const payloads = [
    '<img src=x onerror="window.__pwned=1">',
    '<script>window.__pwned=1</script>',
    '"><svg onload="window.__pwned=1">',
    '<a href="javascript:window.__pwned=1">x</a>',
  ];
  payloads.forEach((p) => type(p));
  await wait(100);
  check('security: HTML in a task shows as plain text', payloads.every((p) => texts().includes(p)));
  check('security: no elements created from task text', !document.querySelector('li img, li script, li svg, li a'));
  check('security: no injected code ran', !window.__pwned);
  check('security: task input has a length limit', q('.new').maxLength > 0 && q('.new').maxLength <= 1000);
  check('security: tile name has a length limit', q('.title').maxLength > 0 && q('.title').maxLength <= 100);

  // Deleting: x sends a task to its tile's history, x there removes it for good, u undoes.
  rows().slice(2).forEach((li) => li.querySelector('.del').click());
  check('x deletes right away', __store.tasks.filter((t) => t.deleted && t.deletedAt).length === 4);
  check('deleted rows animate out', rows().slice(2).every((li) => li.classList.contains('gone')));
  await wait(GONE);
  check('deleted tasks go to history as [-]', rows().length === 2 && rows(0, '.done').length === 4
    && rows(0, '.done').every((li) => li.querySelector('.box').textContent === '[-]'));
  check('deleted tasks are not counted as done', tally.textContent === '0/2 today');
  focused().blur?.();
  key('u');
  await wait(20);
  check('u brings back the last deletion', rows().length === 3 && rows(0, '.done').length === 3 && focused() === task(2));
  key('x');
  await wait(GONE);
  check('x on the selected task deletes it again', rows().length === 2 && rows(0, '.done').length === 4);
  rows(0, '.done').forEach((li) => li.querySelector('.del').click());
  await wait(GONE);
  check('x in history removes for good', __store.tasks.length === 2 && q('.history').hidden);
  key('u');
  await wait(20);
  check('u brings back a task removed for good', __store.tasks.length === 3 && rows(0, '.done').length === 1
    && q('.history').open && focused() === task(0, 0, '.done'));
  task(0, 0, '.done').nextElementSibling.click();
  await wait(GONE);
  check('history empties again', __store.tasks.length === 2 && q('.history').hidden);
  q('.history').open = false;

  // Done: animate, then move to history.
  task(0).click();
  await wait(20);
  check('done is saved right away', __store.tasks.find((t) => t.id === 'a').done === true);
  check('done row animates', rows()[0].classList.contains('finished'));
  check('box spins', rows()[0].querySelector('.box').textContent !== '[ ]');
  task(0).click(); // a second click mid-animation must not undo it
  await wait(300);
  check('sparks fly', document.querySelectorAll('.spark').length > 0);
  await wait(FINISH - 300);
  check('sparks clean up after themselves', document.querySelectorAll('.spark').length === 0);
  check('done row moves to history', texts().join() === 'second' && texts(0, '.done').join() === 'old task');
  check('history count shows', q('.count').textContent === '1' && !q('.history').hidden);
  check('history shows the finish date', rows(0, '.done')[0].querySelector('.when').textContent !== '');
  await wait(300); // the bar grows one # at a time
  check('progress bar counts today', tally.textContent === '1/2 today' && fill.textContent === '#'.repeat(10) && rest.textContent === '-'.repeat(10));
  task(0, 0, '.done').click();
  await wait(RESTORE);
  check('clicking a history task puts it back', texts().includes('old task') && q('.history').hidden);
  check('restored task loses its finish date', !('doneAt' in __store.tasks.find((t) => t.id === 'a')));

  // Hotkeys inside a tile.
  q('.new').focus();
  key('Escape');
  check('Esc moves from input to first task', focused() === task(0));
  key('j');
  check('j moves down', focused() === task(1));
  key('k');
  check('k moves up', focused() === task(0));
  key('k');
  check('k moves up to the tile header', focused() === q('.fold'));
  key('k');
  check('k at the top goes to the input', focused() === q('.new'));
  check('j typed in the input is left alone', !key('j').defaultPrevented);
  key('Escape');
  key('l');
  check('l moves to x', focused() === rows()[0].querySelector('.del'));
  key('h');
  check('h moves back to the task', focused() === task(0));
  check('cmd/ctrl shortcuts are left alone', !key('l', { metaKey: true }).defaultPrevented);
  key(' ');
  await wait(FINISH);
  check('space crosses off', texts(0, '.done').includes('old task'));
  check('focus moves to the next task after crossing off', focused() === task(0));
  key('j');
  check('j reaches the history toggle', focused() === q('summary'));

  // Tiles.
  document.getElementById('add-tile').click();
  await wait(20);
  check('+ tile adds a tile', names().join() === 'todo,untitled');
  check('a new tile starts with its name selected', focused() === q('.title', 1) && q('.title', 1).selectionEnd === 8);
  check('tiles get delete buttons once there are two', getComputedStyle(q('.close')).display !== 'none');
  q('.title', 1).value = '  work  ';
  q('.title', 1).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  q('.title', 1).dispatchEvent(new Event('change', { bubbles: true }));
  await wait(20);
  check('naming a tile saves it trimmed', names()[1] === 'work' && __store.tiles[1].name === 'work');
  check('Enter in a name moves to that tile\'s input', focused() === q('.new', 1));
  type('ship it', 1);
  await wait(20);
  check('tasks go to the tile they were typed in', texts(1).join() === 'ship it' && __store.tasks.at(-1).tile === __store.tiles[1].id);
  q('.title', 1).value = '';
  q('.title', 1).dispatchEvent(new Event('change', { bubbles: true }));
  check('an empty name becomes untitled', names()[1] === 'untitled');
  q('.title', 1).value = '<img src=x onerror="window.__pwned=1">';
  q('.title', 1).dispatchEvent(new Event('change', { bubbles: true }));
  await wait(50);
  check('security: HTML in a tile name stays text', !document.querySelector('.bar img') && !window.__pwned);

  task(0).focus();
  key('j'); // past the history toggle into the next tile
  key('j');
  check('j continues into the next tile', focused() === q('.fold', 1));
  key('K', { shiftKey: true });
  await wait(250);
  check('K moves a tile up', __store.tiles[0].id !== 'main' && allTiles()[1].dataset.id === 'main');
  check('focus stays on the moved tile', focused() === q('.fold', 0));
  key('J', { shiftKey: true });
  await wait(250);
  check('J moves it back down', __store.tiles[0].id === 'main' && allTiles()[0].dataset.id === 'main');

  // Drag the second tile above the first. Layout positions (offsetTop), not on-screen
  // ones, because a tile can still be mid-slide from the J/K move above.
  const top = allTiles()[0].offsetTop - scrollY;
  const bar = q('.bar', 1);
  pointer('pointerdown', bar, allTiles()[1].offsetTop - scrollY);
  pointer('pointermove', null, top + 40);
  pointer('pointermove', null, top + 2);
  pointer('pointerup', null, top + 2);
  q('.fold', 0).click(); // the click that lands after a drag must not collapse anything
  await wait(250);
  check('dragging a tile reorders it', __store.tiles[0].id !== 'main' && allTiles()[1].dataset.id === 'main');
  check('letting go of a drag does not click', !__store.tiles[0].collapsed);
  await wait(20);

  q('.fold', 0).click();
  check('- collapses a tile', __store.tiles[0].collapsed && !q('.body', 0).checkVisibility());
  check('a collapsed tile shows its open count', q('.n', 0).textContent === '1');
  q('.fold', 0).focus();
  key('i');
  check('i opens a collapsed tile and goes to its input', !__store.tiles[0].collapsed && focused() === q('.new', 0));

  // Delete a tile with tasks: asks first.
  q('.close', 0).click();
  check('deleting a tile with tasks asks first', q('.close', 0).textContent === 'del 1?' && __store.tiles.length === 2);
  q('.close', 0).click();
  await wait(GONE);
  check('second click deletes the tile and its tasks', names().join() === 'todo' && !__store.tasks.some((t) => t.text === 'ship it'));
  key('u');
  await wait(20);
  check('u brings back a deleted tile with its tasks', names().length === 2 && texts(0).join() === 'ship it' && focused() === q('.fold', 0));
  q('.close', 0).click();
  q('.close', 0).click();
  await wait(GONE);
  check('tile deleted again', names().join() === 'todo');

  // Another window changes things.
  __fire({ tasks: { newValue: [{ id: 'z', text: 'from other window', done: false, tile: 'main' }] } });
  check('syncs changes from another window', texts().join() === 'from other window' && q('.history').hidden);
  task(0).focus();
  key('x');
  await wait(GONE);
  check('x deletes the selected task', rows().length === 0 && __store.tasks.find((t) => t.id === 'z').deleted);
  check('empty list shows a message', !q('.empty').hidden);
  check('focus returns to the input when a list empties', focused() === q('.new'));
}

async function corrupt() {
  await wait(20);
  check('security: bad tiles are skipped and duplicates dropped', names().join() === 'work' && !q('.tile.collapsed'));
  check('security: bad tasks are skipped', texts().join() === 'quote id,valid' && texts(0, '.done').join() === 'bad date');
  check('security: tasks with a missing tile land in the first tile', texts().includes('valid'));
  check('security: invalid finish date is left blank', rows(0, '.done')[0].querySelector('.when').textContent === '');
  task(0).focus();
  task(0).nextElementSibling.click(); // delete the row whose id contains quotes
  await wait(GONE);
  check('security: odd ids still work', texts().join() === 'valid');
  __fire({ tasks: { newValue: { not: 'a list' } }, tiles: { newValue: 'nope' } });
  await wait(20);
  check('security: junk from another window is handled safely', names().join() === 'todo' && rows().length === 0);
}

(location.hash === '#corrupt' ? corrupt() : main())
  .catch((e) => check(`no crash (${e})`, false))
  .finally(() => {
    check('no page errors', __errors.length === 0);
    __errors.forEach((m) => results.push(`     ${m}`));
    const pre = document.createElement('pre');
    pre.id = 'results';
    pre.textContent = results.join('\n');
    document.body.append(pre);
  });
