// Theme and text size. Loaded in <head> so the page never draws with the wrong ones first.
// Saved in localStorage because it can be read instantly (chrome.storage answers a moment later).
// They're per computer, and losing them only means falling back to the defaults.
const THEMES = ['gruvbox', 'dark', 'light'];
const SIZES = [13, 15, 17, 19, 22, 26]; // px
let prefs = readPrefs();

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
  document.documentElement.dataset.theme = prefs.theme;
  document.documentElement.style.setProperty('--size', `${prefs.size}px`);
}
applyPrefs();

// Another window changed them.
addEventListener('storage', (e) => {
  if (e.key !== 'prefs') return;
  prefs = readPrefs();
  applyPrefs();
  window.showPrefs?.();
});
