// Harness HTTP servers for the host-integration + offline e2e (SP-host). `staticServer` serves a
// built dist/ with its real `_headers` (ADR-0010) and keeps a request log queried over HTTP from the
// Playwright (node) side — the tool page itself cannot reach it (connect-src 'none'). `hostServer`
// serves a stub portal page that embeds the tool and relays theme messages, on a second origin.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { loadHeaders, headersFor } from './headers.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function listen(server, port) {
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

/** Serve `root` (a built dist dir) applying its `_headers`; log every request for NFR-01 checks. */
export async function staticServer({ root, port }) {
  const rules = loadHeaders(path.join(root, '_headers'));
  const log = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const pathname = decodeURIComponent(url.pathname);

    // Control channel (node-side only): dump or reset the request log.
    if (pathname === '/__log/dump') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(log));
      return;
    }
    if (pathname === '/__log/reset') {
      log.length = 0;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('[]');
      return;
    }

    log.push({ method: req.method, path: pathname, contentLength: Number(req.headers['content-length'] ?? 0) });

    // Static file (navigations and index both resolve to index.html); apply the deploy headers.
    let filePath = pathname === '/' ? '/index.html' : pathname;
    let abs = path.join(root, filePath);
    if (!abs.startsWith(root) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      abs = path.join(root, 'index.html'); // SPA fallback
      filePath = '/index.html';
    }
    const headers = { Connection: 'close' };
    for (const h of headersFor(rules, filePath === '/index.html' ? '/' : filePath)) headers[h.name] = h.value;
    headers['Content-Type'] = TYPES[path.extname(abs)] ?? 'application/octet-stream';
    res.writeHead(200, headers);
    res.end(fs.readFileSync(abs));
  });
  await listen(server, port);
  return server;
}

const HOST_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Stub host</title></head>
<body>
<h1>Stub portal</h1>
<script>
  // A minimal TaroKit-portal stand-in: embed the tool, capture every message it sends (the only one
  // should be the ready signal, RULE-16), and offer hooks to push theme and language changes into it.
  window.__received = [];
  const params = new URLSearchParams(location.search);
  const toolSrc = params.get('tool');
  window.__toolOrigin = new URL(toolSrc).origin;
  const frame = document.createElement('iframe');
  // The portal's frame grants (D-006, RULE-16, A2): sandbox with downloads and leave-page dialogs,
  // clipboard writing, and focus moved into the tool after its ready signal. \`grants=0\` drops the
  // grants and \`focus=0\` skips the focus, for the fallback cases (F-015.R7; SP-host, ADR-0021).
  const grants = params.get('grants') !== '0';
  const focusOnReady = params.get('focus') !== '0';
  window.addEventListener('message', (e) => {
    if (e.origin !== window.__toolOrigin) return;
    window.__received.push({ origin: e.origin, data: e.data });
    if (focusOnReady && e.data && e.data.type === 'taro:ready') frame.focus();
  });
  frame.id = 'tool';
  frame.setAttribute('title', 'embedded tool');
  frame.setAttribute(
    'sandbox',
    'allow-scripts allow-same-origin' + (grants ? ' allow-downloads allow-modals' : ''),
  );
  if (grants) frame.setAttribute('allow', 'clipboard-write');
  frame.style.cssText = 'width:100%;height:85vh;border:0';
  frame.src = toolSrc;
  window.__sendTheme = (value) =>
    frame.contentWindow.postMessage({ type: 'taro:theme', value }, window.__toolOrigin);
  // F-018: a language settings message (RULE-16, RULE-17), and any raw payload for the ignore cases.
  window.__sendLanguage = (value) =>
    frame.contentWindow.postMessage({ type: 'taro:language', value }, window.__toolOrigin);
  // F-015.AC5, F-018.AC4: a sibling frame (same origin as the host, not the tool's parent) sends \`data\`.
  window.__fromSibling = (data) => {
    const sib = document.createElement('iframe');
    sib.style.display = 'none';
    document.body.appendChild(sib);
    sib.contentWindow.eval(
      'parent.frames[0].postMessage(' + JSON.stringify(data) + ', ' +
        JSON.stringify(window.__toolOrigin) + ')',
    );
  };
  // Resize the embedded frame (NFR-07: down to 320 px).
  window.__resizeTool = (w, h) => {
    frame.style.width = w + 'px';
    frame.style.height = h + 'px';
  };
  document.body.appendChild(frame);
</script>
</body></html>`;

/** Serve the stub host page (no CSP of its own) on a second origin. */
export async function hostServer({ port }) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname === '/host.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' });
      res.end(HOST_PAGE);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain', Connection: 'close' });
    res.end('not found');
  });
  await listen(server, port);
  return server;
}
