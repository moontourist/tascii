// Run from the repo root: node tests/run.mjs
// Needs Google Chrome. Set CHROME=/path/to/chrome if it isn't in the usual macOS place.
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
  ['host_permissions', 'optional_permissions', 'optional_host_permissions', 'content_scripts',
    'web_accessible_resources', 'externally_connectable'].every((k) => !(k in m)));
check('manifest: strict content security policy',
  m.content_security_policy?.extension_pages === "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'");
check('manifest: version is MAJOR.MINOR.PATCH', /^\d+\.\d+\.\d+$/.test(m.version));
let tag = '';
try { tag = execFileSync('git', ['describe', '--tags', '--exact-match'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {}
if (tag) check(`manifest: version matches git tag ${tag}`, tag === `v${m.version}`);

const sources = readdirSync(root).filter((f) => /\.(js|html|css|json)$/.test(f));
const code = sources.map((f) => [f, read(f)]);
const banned = [
  [/\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write/, 'HTML string injection'],
  [/\beval\(|new Function\(|set(Timeout|Interval)\(\s*['"`]/, 'code from strings'],
  [/\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/, 'network calls'],
  [/https?:\/\//, 'outside URLs'],
];
for (const [re, what] of banned) {
  const hits = code.filter(([, src]) => re.test(src)).map(([f]) => f);
  check(`source: no ${what}${hits.length ? ` (found in ${hits.join(', ')})` : ''}`, hits.length === 0);
}
const html = read('panel.html');
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

for (const hash of ['', '#corrupt']) {
  let dom = '';
  try {
    dom = execFileSync(chrome, ['--headless', '--disable-gpu', `--user-data-dir=${join(tmp, 'profile')}`,
      '--allow-file-access-from-files', '--virtual-time-budget=10000', '--dump-dom',
      pathToFileURL(join(tmp, 'harness.html')).href + hash], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
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
rmSync(tmp, { recursive: true, force: true });

console.log(failed.length ? `\n${failed.length} failed` : '\nall passed');
process.exit(failed.length ? 1 : 0);
