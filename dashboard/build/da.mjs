import fs from 'node:fs';
const p = new URL('../index.html', import.meta.url);
let h = fs.readFileSync(p, 'utf8');
const rep = (a, b, all = false) => { if (!h.includes(a)) throw new Error('introuvable: ' + a.slice(0, 80)); h = all ? h.split(a).join(b) : h.replace(a, b); };
// 1. styles + feuille de la police et de la photo
const style = fs.readFileSync(new URL('./style.css', import.meta.url), 'utf8').trim();
h = '<link rel="stylesheet" href="reiz.css">\n' + style + h.slice(h.indexOf('</style>') + '</style>'.length);
// 2. logo
const site = fs.readFileSync('/Users/yllankarsenty/Desktop/Reiz/site/index.html', 'utf8');
const sym = site.match(/<symbol id="logo"[^>]*>([\s\S]*?)<\/symbol>/)[1].trim().replace(/\s*\n\s*/g, '');
rep('<!--LOGO-->', sym);
// 3. les chiffres clés passent dans l'ouverture, en verre
rep('  </header>\n\n  <section class="rz-section" id="chiffres">\n    <div class="rz-tiles">', '    <div class="rz-tiles" id="chiffres">');
rep('comptes test (démo Apple, testuser) sont exclus des chiffres et des courbes.</p>\n', 'comptes test (démo Apple, testuser) sont exclus des chiffres et des courbes.</p>\n  </header>\n\n  <div class="rz-in">\n  <section class="rz-section" id="activite">\n    <div class="rz-section-head">\n      <h2 class="rz-h2">Activité</h2>\n      <p class="rz-note">Les arrivées et l’usage de l’app jour par jour.</p>\n    </div>\n');
h = h.replace(/<div class="rz-card" id="tile-/g, '<div class="rz-tile rz-glass" id="tile-');
rep('class="rz-label"', 'class="rz-mini"', true);
// fermer .rz-in avant la fin de .rz
const lastSection = h.lastIndexOf('</section>') + '</section>'.length;
h = h.slice(0, lastSection) + '\n  </div>' + h.slice(lastSection);
// 4. détails
rep('<button class="rz-btn" type="button" id="copy-emails">', '<button class="rz-btn rz-btn-white" type="button" id="copy-emails">');
rep('<span class="rz-sub" id="count-membres">', '<span class="rz-count" id="count-membres">');
rep('data-fmt="dec1">—</span> Mo</div>', 'data-fmt="dec1">—</span><small>Mo</small></div>', true);
// 5. couleurs de la DA dans le script
rep("const C = dash.colors;", "const C = ['#ffffff', '#8a8a8a'];\nconst RED = '#ff3b30';");
rep("document.getElementById('sw-served').style.background = 'var(--cds-chart-muted)';", "document.getElementById('sw-served').style.background = C[0];");
rep("document.getElementById('sw-errors').style.background = 'var(--cds-chart-status-critical)';", "document.getElementById('sw-errors').style.background = RED;");
rep("{ field: 'served', label: 'Servies', color: 'var(--cds-chart-muted)' }, { field: 'errors', label: 'Refusées ou en erreur', color: 'var(--cds-chart-status-critical)' }", "{ field: 'served', label: 'Servies', color: C[0] }, { field: 'errors', label: 'Refusées ou en erreur', color: RED }");
rep("t === 0 ? 'var(--cds-chart-axis)' : 'var(--cds-chart-grid)'", "t === 0 ? 'var(--rz-line)' : 'var(--rz-chip)'");
rep("style('fill', 'var(--color-fg-muted)')", "style('fill', 'var(--rz-text-4)')", true);
rep("pct >= 80 ? 'var(--cds-chart-status-critical)' : C[0]", "pct >= 80 ? RED : C[0]");
rep("'Autres': 'var(--cds-chart-muted)'", "'Autres': '#3a3a3a'");
rep("KIND_COLORS[r.kind] || 'var(--cds-chart-muted)'", "KIND_COLORS[r.kind] || '#3a3a3a'");
rep("t && t.errors_5xx > 0 ? 'var(--color-bad)' : ''", "t && t.errors_5xx > 0 ? RED : ''");
rep("if (v > 0) td.style.color = 'var(--color-bad)';", "if (v > 0) td.style.color = RED;");
h = h.replace(/const STATUS_PILL = \{[^\n]*\};/, "const STATUS_PILL = { 'Actif': 'on', 'Calme': 'ring', 'Inactif': 'idle', 'Sans activité': 'idle', 'Compte test': 'test', 'En attente': 'ring', 'Inscrit dans l’app': 'on', 'Test': 'test', 'OK': 'on', 'Échec': 'bad', 'Désactivée': 'idle', 'Jamais lancée': 'ring' };");
rep("el.textContent = 'en hausse'", "el.textContent = '↑ en hausse'");
rep("el.textContent = 'en baisse'", "el.textContent = '↓ en baisse'");
fs.writeFileSync(p, h);
// 6. reiz.css : police Inter de l'app et photo de salle, en data URI
const font = fs.readFileSync('/Users/yllankarsenty/Desktop/Reiz/site/assets/fonts/inter-normal.woff2').toString('base64');
const photo = fs.readFileSync('/Users/yllankarsenty/Desktop/Reiz/site/assets/img/bg-cage-wide.jpg').toString('base64');
const css = `@font-face{font-family:"Inter Reiz";src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:100 900;font-style:normal;font-display:swap}\n.rz-hero-bg{background-image:url(data:image/jpeg;base64,${photo})}\n`;
fs.writeFileSync(new URL('../reiz.css', import.meta.url), css);
console.log('index', h.length, 'reiz.css', css.length, 'leftover cds/color tokens:', (h.match(/var\(--(cds|color)-[a-z-]+\)/g) || []).join(' '));
