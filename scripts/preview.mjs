import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const directory = fileURLToPath(new URL('../dist/', import.meta.url));
const root = resolve(directory);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, {Allow: 'GET, HEAD'}).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.includes('\0')) {
      response.writeHead(400).end();
      return;
    }
    const path = resolve(root, `.${pathname}`, pathname.endsWith('/') ? 'index.html' : '');
    if (!path.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    const content = await readFile(path);
    response.writeHead(200, {
      'Content-Type': types[extname(path)] ?? 'application/octet-stream',
      'Content-Length': content.length,
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    const status = error instanceof URIError || error.code === 'ERR_INVALID_URL' ? 400
      : ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code) ? 404 : 500;
    if (status === 500) console.error(error);
    response.writeHead(status).end();
  }
}).on('error', error => {
  console.error(error.message);
  process.exitCode = 1;
}).listen(8766, '127.0.0.1', () => {
  console.log('Preview: http://127.0.0.1:8766');
});
