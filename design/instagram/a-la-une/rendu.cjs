// usage : node rendu.cjs  → png/a-la-une-*.png, png/story-*.png, png/apercu.png
const { chromium } = require('playwright');
const path = require('node:path');

const page = 'file://' + path.join(__dirname, 'a-la-une.html');
const vues = [
  ['hl-collabs', 'a-la-une-collabs'], ['hl-reposts', 'a-la-une-reposts'],
  ['hl-faq', 'a-la-une-faq'], ['hl-coulisses', 'a-la-une-coulisses'],
  ['st-collabs', 'story-collabs'], ['st-reposts', 'story-reposts'],
  ['st-faq-1', 'story-faq-1'], ['st-faq-2', 'story-faq-2'], ['st-faq-3', 'story-faq-3'], ['st-faq-4', 'story-faq-4'],
  ['st-coulisses', 'story-coulisses'],
  ['apercu', 'apercu'],
];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  for (const [id, nom] of vues) {
    await p.goto(`${page}?f=${id}`);
    await p.evaluate(() => document.fonts.ready);
    await p.locator('#' + id).screenshot({ path: path.join(__dirname, 'png', nom + '.png') });
  }
  await b.close();
})();
