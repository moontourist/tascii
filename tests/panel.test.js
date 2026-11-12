// Runs inside the panel page (see run.mjs). Uses panel.js's globals: input, list, doneList, count, historyBox, empty.
const results = [];
const check = (name, ok) => results.push(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const rows = (ul = list) => [...ul.children];
const texts = (ul = list) => rows(ul).map((li) => li.querySelector('.label').textContent);
const task = (i, ul = list) => rows(ul)[i]?.querySelector('.task');
const type = (v) => {
  input.value = v;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
};
const key = (k, extra = {}) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra });
  (document.activeElement ?? document.body).dispatchEvent(e);
  return e;
};

async function main() {
  type('typed before load'); // races the storage read on purpose
  await wait();
  check('loads saved tasks', texts()[0] === 'old task');
  check('adding before load keeps saved tasks', __store.tasks.length === 2);
  type('   ');
  await wait();
  check('ignores blank input', __store.tasks.length === 2);

  // Security: task text must never turn into HTML or run code.
  const payloads = [
    '<img src=x onerror="window.__pwned=1">',
    '<script>window.__pwned=1</script>',
    '"><svg onload="window.__pwned=1">',
    '<a href="javascript:window.__pwned=1">x</a>',
  ];
  payloads.forEach(type);
  await wait(100);
  check('security: HTML in a task shows as plain text', payloads.every((p) => texts().includes(p)));
  check('security: no elements created from task text', !document.querySelector('li img, li script, li svg, li a'));
  check('security: no injected code ran', !window.__pwned);
  check('security: input has a length limit', input.maxLength > 0 && input.maxLength <= 1000);

  for (let i = 0; i < payloads.length; i++) task(2, list).nextElementSibling.click(); // x on row 3, four times
  await wait();
  check('x deletes a task', __store.tasks.length === 2);

  // Done: animate, then move to history.
  task(0).click();
  await wait();
  check('done is saved right away', __store.tasks.find((t) => t.id === 'a').done === true);
  check('done row animates', rows()[0].classList.contains('leaving'));
  task(0).click(); // a second click mid-animation must not undo it
  await wait(600);
  check('done row moves to history', texts().join() === 'typed before load' && texts(doneList).join() === 'old task');
  check('history count shows', count.textContent === '1' && !historyBox.hidden);
  check('history shows the finish date', rows(doneList)[0].querySelector('.when').textContent !== '');
  await wait(300); // the bar grows one # at a time
  check('progress bar counts today', tally.textContent === '1/2 today' && fill.textContent === '#'.repeat(10) && rest.textContent === '-'.repeat(10));
  task(0, doneList).click();
  await wait();
  check('clicking a history task puts it back', texts().includes('old task') && historyBox.hidden);
  check('restored task loses its finish date', !('doneAt' in __store.tasks.find((t) => t.id === 'a')));

  // Hotkeys.
  input.focus();
  key('Escape');
  check('Esc moves from input to first task', document.activeElement === task(0));
  key('j');
  check('j moves down', document.activeElement === task(1));
  key('j');
  check('j stops at the last task', document.activeElement === task(1));
  key('k');
  check('k moves up', document.activeElement === task(0));
  key('k');
  check('k at the top goes to input', document.activeElement === input);
  check('j typed in the input is left alone', !key('j').defaultPrevented);
  key('Escape');
  key('l');
  check('l moves to x', document.activeElement === rows()[0].querySelector('.del'));
  key('h');
  check('h moves back to the task', document.activeElement === task(0));
  check('cmd/ctrl shortcuts are left alone', !key('l', { metaKey: true }).defaultPrevented);
  key(' ');
  await wait(600);
  check('space crosses off', texts(doneList).includes('old task'));
  check('focus moves to the next task after crossing off', document.activeElement === task(0));
  key('j');
  check('j reaches the history toggle', document.activeElement === historyBox.querySelector('summary'));
  key('j');
  check('j skips tasks inside closed history', document.activeElement === historyBox.querySelector('summary'));
  key('i');
  check('i jumps to the input', document.activeElement === input);

  // Another window changes the list.
  __fire([{ id: 'z', text: 'from other window', done: false }]);
  check('syncs changes from another window', texts().join() === 'from other window' && historyBox.hidden);
  task(0).nextElementSibling.focus();
  task(0).nextElementSibling.click();
  await wait();
  check('empty list shows the cat', !empty.hidden && empty.querySelector('pre').textContent.includes('o.o'));
  check('focus returns to input when the list empties', document.activeElement === input);
}

async function corrupt() {
  await wait();
  check('security: bad stored data is skipped', texts().join() === 'quote id,valid' && texts(doneList).join() === 'bad date');
  check('security: invalid finish date is left blank', rows(doneList)[0].querySelector('.when').textContent === '');
  task(0).focus();
  task(0).nextElementSibling.click(); // delete the row whose id contains quotes
  await wait();
  check('security: odd ids still work', texts().join() === 'valid');
  __fire({ not: 'a list' });
  await wait();
  check('security: non-list data from another window is ignored safely', rows().length === 0);
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
