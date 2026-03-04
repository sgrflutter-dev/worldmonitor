#!/usr/bin/env node
/**
 * Self-hosted static file server + API proxy for World Monitor.
 *
 * - Serves the built SPA from dist/ on port 3000
 * - Proxies /api/* requests to the sidecar local-api-server on port 46123
 * - Injects Origin header to pass the existing CORS/API-key allowlist
 * - SPA fallback: serves index.html for all non-file routes
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 3000);
const SIDECAR_PORT = Number(process.env.SIDECAR_PORT || 46123);
const SIDECAR_HOST = '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.br': 'application/octet-stream',
};

function proxyToSidecar(req, res) {
  const proxyReq = http.request(
    {
      hostname: SIDECAR_HOST,
      port: SIDECAR_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${SIDECAR_HOST}:${SIDECAR_PORT}`,
        origin: 'https://worldmonitor.app',
      },
    },
    (proxyRes) => {
      // Remove CORS headers from sidecar — let the browser handle same-origin
      const headers = { ...proxyRes.headers };
      delete headers['access-control-allow-origin'];
      delete headers['vary'];
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', (err) => {
    console.error(`[proxy] ${req.method} ${req.url} → error: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'application/json' });
    }
    res.end(JSON.stringify({ error: 'API proxy error', message: err.message }));
  });

  req.pipe(proxyReq);
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Try serving pre-compressed brotli version
  const brPath = filePath + '.br';
  if (ext !== '.br' && fs.existsSync(brPath)) {
    const stat = fs.statSync(brPath);
    res.writeHead(200, {
      'content-type': contentType,
      'content-encoding': 'br',
      'content-length': stat.size,
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    fs.createReadStream(brPath).pipe(res);
    return;
  }

  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'content-type': contentType,
    'content-length': stat.size,
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  fs.createReadStream(filePath).pipe(res);
}

function serveIndex(res) {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('index.html not found');
    return;
  }
  const stat = fs.statSync(indexPath);
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': stat.size,
    'cache-control': 'no-cache',
  });
  fs.createReadStream(indexPath).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  // Proxy all /api/* requests to the sidecar
  if (url.pathname.startsWith('/api/')) {
    proxyToSidecar(req, res);
    return;
  }

  // Static file serving
  const safePath = path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(DIST_DIR, safePath);

  // Security: ensure we stay within DIST_DIR
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveFile(res, filePath);
    return;
  }

  // SPA fallback — serve index.html for all non-file routes
  serveIndex(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] Static file server listening on http://0.0.0.0:${PORT}`);
  console.log(`[server] Proxying /api/* → http://${SIDECAR_HOST}:${SIDECAR_PORT}`);
});
