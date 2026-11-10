import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL(process.argv.includes('--dist') ? '../dist/' : '../', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
// Only frontend files are served. Project configuration and tests stay private.
const allowed = new Set(['/index.html', '/sw.js', '/src/app.js', '/src/model.js', '/src/business.js', '/src/backup.js', '/src/access.js', '/src/admin.js', '/src/ownership.js', '/src/catalog.js', '/src/inventory-entry.js', '/src/style.css', '/src/themes.js', '/src/themes.css']);
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    let pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/') pathname = '/index.html';
    if (!allowed.has(pathname)) {
      res.writeHead(404).end('Topilmadi');
      return;
    }
    const content = await readFile(path.join(root, pathname));
    res.writeHead(200, {
      'Content-Type': types[path.extname(pathname)],
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    res.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Faylni ochib bo‘lmadi.');
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `${port} port band. PORT=4174 npm run dev bilan qayta urinib ko‘ring.` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`TelefonZona: http://localhost:${port}`));
