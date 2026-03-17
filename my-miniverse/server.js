import { MiniverseServer } from '@miniverse/server';
  import http from 'http';
  import { WebSocket, WebSocketServer } from 'ws';
  import fs from 'fs';
  import path from 'path';
  import { fileURLToPath } from 'url';

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const DIST = path.join(__dirname, 'dist');
  const PORT = parseInt(process.env.PORT ?? '4321');
  const INTERNAL = PORT + 1;

  const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript',
    '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  };

  const mv = new MiniverseServer({ port: INTERNAL });
  await mv.start();
  console.log(`Miniverse API → internal port ${INTERNAL}`);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const opts = { hostname: 'localhost', port: INTERNAL, path: req.url, method: req.method, headers: req.headers };
      const p = http.request(opts, (pr) => { res.writeHead(pr.statusCode, pr.headers); pr.pipe(res); });
      p.on('error', () => { res.writeHead(502); res.end(); });
      req.pipe(p);
      return;
    }
    let fp = path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) fp = path.join(DIST, 'index.html');
    try {
      const content = fs.readFileSync(fp);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] ?? 'application/octet-stream' });
      res.end(content);
    } catch { res.writeHead(404); res.end('Not found'); }
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const target = new WebSocket(`ws://localhost:${INTERNAL}/ws`);
    target.on('open', () => {
      wss.handleUpgrade(req, socket, head, (client) => {
        client.on('message', (m) => target.send(m));
        target.on('message', (m) => client.send(m));
        client.on('close', () => target.close());
        target.on('close', () => client.close());
      });
    });
    target.on('error', () => socket.destroy());
  });

  server.listen(PORT, () => console.log(`✓ Running on port ${PORT}`));
