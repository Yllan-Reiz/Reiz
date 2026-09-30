// Rendu d'un reel Reiz image par image (page reel.html qui expose render(t)).
//   node render-reel.mjs reel-01 stills 0 3 8    → images fixes dans reel-01/out/stills/
//   node render-reel.mjs reel-01 video 0 14.5 reel.mp4 → vidéo sans son, 30 i/s (le son se choisit dans Instagram)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2]);
const OUT = path.join(ROOT, 'out');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const [, mode = 'stills', ...rest] = process.argv.slice(2); const fmt = 'v';
const VW = fmt === 'v' ? 1080 : 1920, VH = fmt === 'v' ? 1920 : 1080;
const PORT = 8700 + Math.floor(Math.random() * 200), DPORT = 9300 + Math.floor(Math.random() * 200), FPS = 30, DUR = 35;
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const profile = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'reizfilm-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DPORT}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--force-device-scale-factor=1',
  `--window-size=${VW},${VH}`, '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });

function cleanup() { try { chrome.kill('SIGKILL'); } catch { } try { srv.kill(); } catch { } try { fs.rmSync(profile, { recursive: true, force: true }); } catch { } }
process.on('exit', cleanup);

let ok = false;
for (let i = 0; i < 150 && !ok; i++) { try { await (await fetch(`http://127.0.0.1:${DPORT}/json/version`)).json(); ok = true; } catch { await sleep(100); } }
const tgt = await (await fetch(`http://127.0.0.1:${DPORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let seq = 0; const pending = new Map(); const reqs = new Map();
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
  else if (m.method === 'Runtime.exceptionThrown') console.error('JS:', m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') console.error('console:', m.params.args.map(a => a.value).join(' '));
  else if (m.method === 'Network.loadingFailed') console.error('réseau:', m.params.errorText, reqs.get(m.params.requestId) || '');
  else if (m.method === 'Network.requestWillBeSent') reqs.set(m.params.requestId, m.params.request.url);
});
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++seq; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: 1, mobile: false });
// le petit serveur python coupe parfois une requête d'image : on recharge tant qu'une image manque
for (let essai = 0; ; essai++) {
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/reel.html` });
  for (let i = 0; ; i++) {
    const r = await send('Runtime.evaluate', { expression: 'window.__ready===true', returnByValue: true });
    if (r.result.value) break;
    if (i > 300) throw new Error('page pas prête');
    await sleep(100);
  }
  const ko = (await send('Runtime.evaluate', { expression: '[...document.images].filter(i => !i.naturalWidth).map(i => i.src).join(" ")', returnByValue: true })).result.value;
  if (!ko) break;
  if (essai >= 5) throw new Error('images manquantes : ' + ko);
  console.error('images manquantes, rechargement :', ko);
  await sleep(300);
}

async function frameAt(t) {
  await send('Runtime.evaluate', { expression: `render(${t}); new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`, awaitPromise: true });
  const shot = await send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  return Buffer.from(shot.data, 'base64');
}

if (mode === 'stills') {
  for (const s of rest) {
    const t = parseFloat(s);
    fs.writeFileSync(path.join(OUT, 'stills', `t${t.toFixed(2).padStart(5, '0')}.png`), await frameAt(t));
  }
  console.log('stills ok', rest.join(' '));
} else if (mode === 'video') {
  const a = parseFloat(rest[0] ?? '0'), b = parseFloat(rest[1] ?? String(DUR));
  const file = path.join(OUT, rest[2] || 'video.mp4');
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n0 = Math.round(a * FPS), n1 = Math.round(b * FPS);
  const t0 = Date.now();
  for (let n = n0; n < n1; n++) {
    const buf = await frameAt(n / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (n % 60 === 0) console.log(`image ${n}/${n1}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('vidéo ok', file);
}
ws.close();
cleanup();
process.exit(0);
