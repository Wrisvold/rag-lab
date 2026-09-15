// A tiny local file server for trying RAG Lab on your own computer.
// It is NOT needed for hosting; any web host that serves plain files works.
//
//   node serve.js
//
// Then open http://localhost:5173 in your browser. Press Ctrl+C to stop.
// (Opening index.html straight from the file system does not work because the
// browser refuses to load ES modules from file:// addresses.)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = normalize(path === '/' ? '/index.html' : path).replace(/^([/\\])+/, '');
  const file = join(ROOT, relative);
  if (!file.startsWith(ROOT)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found: ' + path);
  }
}).listen(PORT, () => {
  console.log(`RAG Lab is running at http://localhost:${PORT}  (Ctrl+C to stop)`);
});
