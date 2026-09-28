#!/usr/bin/env node
/**
 * Minimal static file server for local development (`npm run serve`).
 * Not used in production — the container serves the site with nginx.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const PORT = Number.parseInt(process.env.PORT || '8080', 10);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * Resolve a request URL to a file inside the site root, blocking traversal.
 *
 * @param {string} requestUrl incoming request url
 * @returns {string|null} absolute file path, or null when outside the root
 */
function resolvePath(requestUrl) {
  const clean = decodeURIComponent((requestUrl || '/').split('?')[0]);
  const relative = clean === '/' ? 'index.html' : clean.replace(/^\/+/, '');
  const candidate = path.join(ROOT, relative);
  const normalized = path.normalize(candidate);
  if (!normalized.startsWith(ROOT)) {
    return null;
  }
  return normalized;
}

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok\n');
    return;
  }

  const filePath = resolvePath(req.url);
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found\n');
    return;
  }

  const type = CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(filePath).pipe(res);
});

if (require.main === module) {
  server.listen(PORT, () => {
    process.stdout.write(`serving ${ROOT} on http://localhost:${PORT}\n`);
  });
}

module.exports = { resolvePath, server };
