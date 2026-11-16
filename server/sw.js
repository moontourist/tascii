// Lets the home server's page open with no signal. Files come from the server when it answers, so
// updates show straight away, and from this saved copy when it doesn't (or takes too long on a weak
// signal). The list itself isn't kept here: sync.js keeps the last copy and the changes still waiting.
const FILES = ['./', 'panel.css', 'panel.js', 'prefs.js', 'sync.js', 'manifest.webmanifest', 'favicon.ico',
  'icons/app-180.png', 'icons/app-192.png', 'icons/app-512.png'];
const WAIT = 3000; // how long a weak signal gets before the saved copy is used

addEventListener('install', (e) => e.waitUntil(caches.open('tascii').then((c) => c.addAll(FILES)).then(() => skipWaiting())));
addEventListener('activate', (e) => e.waitUntil(clients.claim()));

addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith((async () => {
    const cache = await caches.open('tascii');
    try {
      const r = await Promise.race([fetch(e.request), new Promise((_, no) => setTimeout(no, WAIT))]);
      if (r.ok) cache.put(e.request, r.clone());
      return r;
    } catch {
      return (await cache.match(e.request, { ignoreSearch: true })) ?? Response.error();
    }
  })());
});
