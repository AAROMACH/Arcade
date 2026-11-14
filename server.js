// Aaromach Arcade: a tiny static file server for Firebase App Hosting (or any Node host).
// No dependencies. Serves ./public with the same caching rules as firebase.json.
// Plain Firebase Hosting doesn't use this file; it serves ./public directly.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function cacheControl(rel) {
  if (rel === 'sw.js') return 'no-store';
  if (/\.(html|js|webmanifest)$/.test(rel)) return 'no-cache';
  if (rel.startsWith('icons/')) return 'public, max-age=604800';
  return 'public, max-age=3600';
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });

  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { return send(res, 400, 'Bad request'); }
  if (pathname.includes('\0')) return send(res, 400, 'Bad request');

  // Resolve inside ./public only (no ../ escapes).
  let file = path.normalize(path.join(ROOT, pathname));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');

  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) { file = path.join(file, 'index.html'); return fs.stat(file, (e2, st2) => serve(e2, st2)); }
    serve(err, st);
  });

  function serve(err, st) {
    if (err || !st.isFile()) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const headers = {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': cacheControl(rel),
      'Last-Modified': st.mtime.toUTCString(),
    };
    if (rel === 'sw.js') headers['Service-Worker-Allowed'] = '/';
    if (req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(st.mtime.toUTCString())) {
      return send(res, 304, null, { 'Cache-Control': headers['Cache-Control'] });
    }
    res.writeHead(200, { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', ...headers });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Aaromach Arcade on port ${PORT}`));
