const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const cl = x => Math.max(0, Math.min(1, x)), seg = (t, a, b) => cl((t - a) / (b - a));
const ex = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const io = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const back = x => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const lerp = (a, b, k) => a + (b - a) * k;
function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function dust(seed) { const r = rng(seed); let h = ''; for (let i = 0; i < 40; i++) h += `<div class="mote" data-x="${r() * 1080}" data-y="${r() * 1920}" data-v="${8 + r() * 24}" data-p="${r() * 6.28}" data-s="${.3 + r() * .9}"></div>`; $('#dust').innerHTML = h; }
function scene(t, id, a, b, first) {
  const el = $('#' + id), on = t >= a && t < b;
  const k = first ? 1 : ex(seg(t, a, a + .45)), o = seg(t, b - .22, b);
  el.style.opacity = on ? Math.min(cl(k * 1.6), 1 - o) : 0;
  el.style.transform = `scale(${lerp(.94, 1, k) + o * .08})`;
  el.style.filter = `blur(${(1 - k) * 14 + o * 16}px)`;
  return on;
}
function lineUp(sp, t, a, d = .55) { const k = ex(seg(t, a, a + d)); sp.style.transform = `translateY(${(1 - k) * 110}%)`; }
function lines(sel, t, a, step = .14) { $$(sel + ' .line > span').forEach((s, i) => lineUp(s, t, a + i * step)); }
function pop(id, t, a, d = .4, dy = 24) { const q = seg(t, a, a + d), e = $(id); e.style.opacity = cl(q * 2.5); e.style.transform = `translateY(${(1 - back(q)) * dy}px)`; }
function glow(col, a) { const [r, g, b] = col; $('#glow').style.background = `radial-gradient(circle, rgba(${r},${g},${b},${.4 * a}) 0%, rgba(${r},${g},${b},${.12 * a}) 30%, transparent 62%)`; }
function grain(t) { const c = $('#grain'), x = c.getContext('2d'), im = x.createImageData(540, 960), r = rng(Math.floor(t * 30) + 3), d = im.data; for (let i = 0; i < d.length; i += 4) { const v = r() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } x.putImageData(im, 0, 0); }
function motes(t) { $$('.mote').forEach(m => { const y = ((+m.dataset.y - t * +m.dataset.v) % 1920 + 1920) % 1920, x = +m.dataset.x + Math.sin(t * .6 + +m.dataset.p) * 18; m.style.transform = `translate(${x}px, ${y}px) scale(${m.dataset.s})`; m.style.opacity = .1 + .08 * Math.sin(t * 1.7 + +m.dataset.p); }); }
function ready(fn) { window.render = fn; Promise.all([document.fonts.ready, ...[...document.images].map(i => i.decode().catch(() => {}))]).then(() => { fn(Number(new URLSearchParams(location.search).get('t') || 0)); window.__ready = true; }); }
