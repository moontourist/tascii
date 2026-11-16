// Run from the repo root: node tests/run.mjs
// Needs Google Chrome. Set CHROME=/path/to/chrome if it isn't in the usual macOS place.
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');
const failed = [];
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failed.push(name);
};

// --- Static checks: what the extension is allowed to do. ---
const m = JSON.parse(read('manifest.json'));
check('manifest: only the sidePanel and storage permissions', JSON.stringify([...m.permissions].sort()) === '["sidePanel","storage"]');
check('manifest: no website access, content scripts, or outside messaging',
  ['host_permissions', 'optional_permissions', 'content_scripts',
    'web_accessible_resources', 'externally_connectable'].every((k) => !(k in m)));
// Website access only when you connect a home server, and then Chrome asks for that one address.
check('manifest: website access only on request (for a home server)',
  JSON.stringify(m.optional_host_permissions) === '["http://*/*","https://*/*"]');
check('manifest: strict content security policy',
  m.content_security_policy?.extension_pages === "default-src 'self'; script-src 'self'; connect-src 'self' http: https:; object-src 'none'; base-uri 'none'; form-action 'none'");
check('manifest: version is MAJOR.MINOR.PATCH', /^\d+\.\d+\.\d+$/.test(m.version));
// Extension tags are vX.Y.Z; the website has its own site-vX.Y.Z tags.
let tag = '';
try { tag = execFileSync('git', ['tag', '--points-at', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n').find((t) => /^v\d/.test(t)) ?? ''; } catch {}
if (tag) check(`manifest: version matches git tag ${tag}`, tag === `v${m.version}`);

const sources = readdirSync(root).filter((f) => /\.(js|html|css|json)$/.test(f));
const code = sources.map((f) => [f, read(f)]);
const banned = [
  [/\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write/, 'HTML string injection'],
  [/\beval\(|new Function\(|set(Timeout|Interval)\(\s*['"`]/, 'code from strings'],
  [/\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/, 'network calls'],
];
// sync.js talks to your home server, and only when one is set: every request it makes goes to that address.
for (const [re, what] of banned) {
  const hits = code.filter(([f, src]) => re.test(src) && !(f === 'sync.js' && what === 'network calls')).map(([f]) => f);
  check(`source: no ${what}${hits.length ? ` (found in ${hits.join(', ')})` : ''}`, hits.length === 0);
}
const syncFetches = read('sync.js').match(/\bfetch\([^,]*/g) ?? [];
check('source: sync.js only fetches from the server address', syncFetches.length > 0
  && syncFetches.every((f) => f.startsWith('fetch(base + ') || f.startsWith('fetch(`${serverBase(address)}')));
// The only outside URL allowed is the GitHub link: a plain link that opens a new tab, and the manifest's homepage.
const GITHUB = 'https://github.com/moontourist/tascii';
const urls = code.flatMap(([f, src]) => (src.match(/https?:\/\/[^\s"'`)<>]+/g) ?? []).map((u) => `${u} (${f})`));
const allowed = [`${GITHUB} (panel.html)`, `${GITHUB} (manifest.json)`, // the button, and the manifest's homepage_url
  'http://*/* (manifest.json)', 'https://*/* (manifest.json)']; // home server access, asked for one address at a time
const stray = urls.filter((u) => !allowed.includes(u));
check(`source: no outside URLs except the GitHub link${stray.length ? ` (found ${stray.join(', ')})` : ''}`, stray.length === 0);
const html = read('panel.html');
// Every file the extension uses must go into the store zip.
const pack = read('pack.sh');
const needed = [...sources, ...Object.values(m.icons)];
const missing = needed.filter((f) => !pack.includes(f));
check(`pack: zip includes every extension file${missing.length ? ` (missing ${missing.join(', ')})` : ''}`, missing.length === 0);
check('source: GitHub link opens a new tab without access to this page',
  html.includes(`<a id="github" href="${GITHUB}" target="_blank" rel="noopener noreferrer"`));
check('source: no inline scripts or on* handlers in HTML', !/<script(?![^>]*\bsrc=)[^>]*>|\son\w+=/i.test(html));

// --- Browser checks: run the panel in headless Chrome with fake storage. ---
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const tmp = mkdtempSync(join(tmpdir(), 'tascii-test-'));
const url = (f) => pathToFileURL(join(root, f)).href;
const page = html
  .replace('<meta charset="utf-8">', `<meta charset="utf-8"><base href="${url('/')}">`)
  .replace('<script src="panel.js"></script>',
    `<script src="${url('tests/stub.js')}"></script><script src="panel.js"></script><script src="${url('tests/panel.test.js')}"></script>`);
writeFileSync(join(tmp, 'harness.html'), page);

// A real home server for the #server run, with a throwaway list and the password "pw".
const port = 40000 + Math.floor(Math.random() * 20000);
const server = spawn(process.execPath, [join(root, 'server/server.mjs')], {
  env: { ...process.env, PORT: String(port), TASCII_DATA: join(tmp, 'server.json'), TASCII_PASSWORD: 'pw' }, stdio: 'ignore',
});
for (let i = 0; i < 50; i++) {
  try { await fetch(`http://localhost:${port}/`); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
}

// Side panel size for the main runs; a wide window for tiling. The #server run reloads the page twice
// and talks to localhost from a file:// page, which needs web security off (the extension has host permission instead).
for (const [hash, size] of [['', '420,900'], ['#corrupt', '420,900'], ['#tiled', '1200,1000'], ['#server', '420,900']]) {
  let dom = '';
  try {
    dom = execFileSync(chrome, ['--headless', '--disable-gpu', `--user-data-dir=${join(tmp, 'profile')}`,
      '--allow-file-access-from-files', '--virtual-time-budget=10000', `--window-size=${size}`, '--dump-dom',
      ...(hash === '#server' ? ['--disable-web-security'] : []),
      `${pathToFileURL(join(tmp, 'harness.html')).href}?port=${port}${hash}`], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch (e) {
    check(`browser: Chrome ran (${e.message.split('\n')[0]})`, false);
    continue;
  }
  const out = dom.match(/<pre id="results">([\s\S]*?)<\/pre>/)?.[1];
  if (!out) { check(`browser${hash}: tests produced results`, false); continue; }
  for (const line of out.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&amp;', '&').split('\n')) {
    if (line.startsWith('     ')) { console.log(line); continue; }
    check(`browser${hash}: ${line.slice(5)}`, line.startsWith('ok'));
  }
}
server.kill();
rmSync(tmp, { recursive: true, force: true });

console.log(failed.length ? `\n${failed.length} failed` : '\nall passed');
process.exit(failed.length ? 1 : 0);
