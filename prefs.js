// Theme and text size, for the panel and the website (tascii-list.com follows the demo's theme). Loaded in <head> so the page never draws with the wrong ones first.
// Saved in localStorage because it can be read instantly (chrome.storage answers a moment later).
// They're per computer, and losing them only means falling back to the defaults.
const THEMES = ['gruvbox', 'dark', 'light'];
const SIZES = [13, 15, 17, 19, 22, 26]; // px
let prefs = readPrefs();
let shownTheme; // the theme on screen, or on its way there

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

function applyPrefs() {
  const root = document.documentElement;
  const change = () => {
    root.dataset.theme = prefs.theme;
    root.style.setProperty('--size', `${prefs.size}px`);
  };
  // A new theme wipes across from the left (the CSS is in ::view-transition). Not on first load.
  const wipe = shownTheme && shownTheme !== prefs.theme
    && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  shownTheme = prefs.theme;
  // Embedded in the website's demo, the page around it runs one wipe over everything, so this
  // changes a couple of frames later to land inside that wipe (two wipes at once can freeze Chrome).
  if (wipe && window !== top) requestAnimationFrame(() => requestAnimationFrame(change));
  // A wipe cut short (say, by another change) just skips the animation: the new theme still applies.
  else if (wipe) document.startViewTransition(change).ready.catch(() => {});
  else change();
}
applyPrefs();

// Another window changed them.
addEventListener('storage', (e) => {
  if (e.key !== 'prefs') return;
  prefs = readPrefs();
  applyPrefs();
  window.showPrefs?.();
});
