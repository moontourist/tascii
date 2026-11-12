// Theme and text size, for the panel and the website (tascii-list.com follows the demo's theme). Loaded in <head> so the page never draws with the wrong ones first.
// Saved in localStorage because it can be read instantly (chrome.storage answers a moment later).
// They're per computer, and losing them only means falling back to the defaults.
const THEMES = ['gruvbox', 'dark', 'light'];
const SIZES = [13, 15, 17, 19, 22, 26]; // px
let prefs = readPrefs();
let onScreen = ''; // the theme and size on screen (or on their way), as "theme/size"

function readPrefs() {
  let p = {};
  try {
    p = JSON.parse(localStorage.getItem('prefs')) ?? {};
  } catch {} // blocked or junk: use the defaults
  return {
    theme: THEMES.includes(p.theme) ? p.theme : 'gruvbox',
    size: SIZES.includes(p.size) ? p.size : 15,
  };
}

function drawPrefs() {
  document.documentElement.dataset.theme = prefs.theme;
  document.documentElement.style.setProperty('--size', `${prefs.size}px`);
}

function applyPrefs() {
  const was = onScreen;
  onScreen = `${prefs.theme}/${prefs.size}`;
  if (onScreen === was) return; // nothing new (say, our own change coming back from another window)
  // A new theme wipes across from the left (the CSS is in ::view-transition). Not on first load.
  const wipe = was && !was.startsWith(`${prefs.theme}/`)
    && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!wipe) return drawPrefs();
  // Inside the website's demo, the page around it runs one wipe with this change inside it,
  // so both switch together (two wipes at once can also freeze Chrome).
  let host = null;
  try {
    if (window !== top && typeof top.wipeIn === 'function') host = top;
  } catch {} // a page from another site: no access, wipe on our own
  // A wipe cut short (say, by another change) just skips the animation: the new theme still applies.
  if (host) host.wipeIn(drawPrefs);
  else document.startViewTransition(drawPrefs).ready.catch(() => {});
}
applyPrefs();

// Called by a copy of this page embedded in this one (the website's demo): wipe both at once.
function wipeIn(inner) {
  prefs = readPrefs(); // the demo saved them already
  onScreen = `${prefs.theme}/${prefs.size}`;
  document.startViewTransition(() => {
    inner();
    drawPrefs();
  }).ready.catch(() => {});
}

// Another window changed them.
addEventListener('storage', (e) => {
  if (e.key !== 'prefs') return;
  prefs = readPrefs();
  applyPrefs();
  window.showPrefs?.();
});
