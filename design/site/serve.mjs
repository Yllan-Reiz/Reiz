import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.join(path.dirname(new URL(import.meta.url).pathname), 'site');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.avif':'image/avif', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.xml':'application/xml', '.txt':'text/plain', '.webmanifest':'application/manifest+json' };
const port = Number(process.argv[2] || 4610);
http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(new URL(req.url.replace(/^\/+/, '/'), 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return fs.createReadStream(path.join(root, '404.html')).pipe(res); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, () => console.log('serving ' + root + ' on ' + port));
