// node shoot.mjs <url> <out.png> <width> [mobile] [fullHeight|viewportH] [clip:y,h]
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path';
const [url, out, w = '1440', mode = 'desktop', hArg = 'full'] = process.argv.slice(2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DPORT = 9300 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'shoot-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DPORT}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
try {
  let tgt;
  for (let k = 0; k < 50; k++) { try { const l = await (await fetch(`http://127.0.0.1:${DPORT}/json`)).json(); tgt = l.find(t => t.type === 'page'); if (tgt) break; } catch {} await sleep(200); }
  ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
  const mobile = mode === 'mobile'; const W = Number(w);
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: mobile ? 844 : 900, deviceScaleFactor: 1, mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: process.env.MOTION ? 'no-preference' : 'reduce' }] });
  await send('Page.navigate', { url }); await sleep(2500);
  await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(()=>1)', awaitPromise: true });
  await send('Runtime.evaluate', { expression: "document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager')" });
  await sleep(2500);
  let H = 900;
  if (hArg === 'full') {
    const r = await send('Runtime.evaluate', { expression: 'document.documentElement.scrollHeight', returnByValue: true }); H = r.result.value;
    await sleep(800);
  } else { H = Number(hArg); await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile }); await sleep(2600); }
  const shot = await send('Page.captureScreenshot', hArg === 'full' ? { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } } : { format: 'png' });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('ok', out, W, H);
} catch (e) { console.error(e); } finally { try { chrome.kill('SIGKILL'); } catch {} fs.rmSync(profile, { recursive: true, force: true }); process.exit(0); }
