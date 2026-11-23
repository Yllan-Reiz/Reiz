// usage : node rendu.cjs  → png/a-la-une-*.png (couvertures), png/story-*.png (stories d'ouverture), png/apercu.png
const { chromium } = require('playwright');
const path = require('node:path');

const page = 'file://' + path.join(__dirname, 'a-la-une.html');
const couvertures = ['appli', 'reposts', 'collabs', 'badges', 'faq', 'coulisses', 'cercle', 'nouveau'];
const stories = ['collabs', 'reposts', 'faq-1', 'faq-2', 'faq-3', 'faq-4', 'coulisses'];
const vues = [
  ...couvertures.map(n => ['hl-' + n, 'a-la-une-' + n]),
  ...stories.map(n => ['st-' + n, 'story-' + n]),
  ['apercu', 'apercu'], // en dernier : il relit les couvertures tout juste rendues
];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  for (const [id, nom] of vues) {
    await p.goto(`${page}?f=${id}`, { waitUntil: 'networkidle' });
    await p.evaluate(async () => { await document.fonts.load('20px Ionicons'); await document.fonts.load('900 20px Inter'); await document.fonts.ready; });
    await p.screenshot({ path: path.join(__dirname, 'png', nom + '.png'), clip: await p.locator('#' + id).boundingBox() });
  }
  await b.close();
})();
