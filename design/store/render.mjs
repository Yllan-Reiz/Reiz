// Rend les visuels des stores avec Chrome sans fenêtre.
//   node render.mjs ios65 1 2 3      → out/ios-6.5/01.png ...   (1284 x 2778)
//   node render.mjs ios69            → tous les visuels en 1320 x 2868
//   node render.mjs play             → tous les visuels en 1080 x 1920 (sans bouton Apple sur l'accueil)
// Sans numéro de visuel : les 8.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const PRESETS = {
  ios65: { dir: 'ios-6.5', w: 1284, h: 2778, p: 'ios' },
  ios69: { dir: 'ios-6.9', w: 1320, h: 2868, p: 'ios' },
  play: { dir: 'play', w: 1080, h: 1920, p: 'play' },
  bandeplay: { dir: 'bande-play', w: 1284, h: 2568, stageH: 2778, p: 'play', page: 'bande.html', panels: 8, stripW: 8 * 1284 },
  bande: { dir: 'bande', w: 1284, h: 2778, p: 'ios', page: 'bande.html', panels: 8, stripW: 8 * 1284 },
  feature: { dir: 'play', w: 1024, h: 500, p: 'play', page: 'bande.html', extra: '&f=1', file: 'feature-1024x500.png' },
};
const [presetName = 'ios65', ...nums] = process.argv.slice(2);
const P = PRESETS[presetName];
if (!P) { console.error('formats : ' + Object.keys(PRESETS).join(', ')); process.exit(1); }
const slides = P.panels ? Array.from({ length: P.panels }, (_, i) => i + 1) : (P.extra || P.page) ? [1] : nums.length ? nums.map(Number) : [1, 2, 3, 4, 5, 6, 7, 8];
const OUT = path.join(ROOT, 'out', P.dir);
fs.mkdirSync(OUT, { recursive: true });

const PORT = 8800 + Math.floor(Math.random() * 150), DPORT = 9500 + Math.floor(Math.random() * 150);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MIME = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, s) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); s.end(d); });
}).listen(PORT, '127.0.0.1');
const profile = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'reizstore-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DPORT}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--force-device-scale-factor=1',
  `--window-size=${P.w},${P.h}`, '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill('SIGKILL'); } catch { } try { srv.close(); } catch { } try { fs.rmSync(profile, { recursive: true, force: true }); } catch { } };
process.on('exit', cleanup);

let ok = false;
for (let i = 0; i < 150 && !ok; i++) { try { await (await fetch(`http://127.0.0.1:${DPORT}/json/version`)).json(); ok = true; } catch { await sleep(100); } }
const tgt = await (await fetch(`http://127.0.0.1:${DPORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let seq = 0; const pending = new Map();
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
  else if (m.method === 'Runtime.exceptionThrown') console.error('JS:', m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  else if (m.method === 'Network.loadingFailed') console.error('réseau:', m.params.errorText);
});
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++seq; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');

for (const n of slides) {
  await send('Emulation.setDeviceMetricsOverride', { width: P.w, height: P.h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${P.page || 'store.html'}?s=${n}&w=${P.stripW || P.w}&h=${P.stageH || P.h}&p=${P.p}${P.panels ? '&px=' + (n - 1) : ''}${P.extra || ''}` });
  for (let i = 0; ; i++) {
    const r = await send('Runtime.evaluate', { expression: 'window.__ready===true', returnByValue: true });
    if (r.result.value) break;
    if (i > 300) throw new Error('page pas prête, visuel ' + n);
    await sleep(100);
  }
  await sleep(250);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const raw = path.join(OUT, `_${String(n).padStart(2, '0')}.png`);
  const final = path.join(OUT, P.file || (P.panels ? `panneau-${n}.png` : `${String(n).padStart(2, '0')}.png`));
  fs.writeFileSync(raw, Buffer.from(shot.data, 'base64'));
  // Les stores refusent la transparence : on aplatit en RVB.
  await new Promise((res, rej) => spawn(FFMPEG, ['-y', '-loglevel', 'error', '-i', raw, '-vf', 'format=rgb24', final]).on('close', c => c ? rej(new Error('ffmpeg')) : res()));
  fs.rmSync(raw);
  console.log('ok', final);
}
cleanup();
process.exit(0);
