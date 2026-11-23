import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { isFrontendPath, CONTENT_TYPES } from './frontend-files.mjs';

const root = fileURLToPath(new URL(process.argv.includes('--dist') ? '../dist/' : '../', import.meta.url));
const port = Number(process.env.PORT || 4173);
// Only frontend files are served. Project configuration and tests stay private.
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    let pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/') pathname = '/index.html';
    if (!isFrontendPath(pathname)) {
      res.writeHead(404).end('Topilmadi');
      return;
    }
    const content = await readFile(path.join(root, pathname));
    res.writeHead(200, {
      'Content-Type': CONTENT_TYPES[path.extname(pathname)] || 'application/octet-stream',
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
