import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { AgentStore } from './store.js';
import { getFrontendHtml } from './frontend.js';

export interface MiniverseServerConfig {
  port?: number;
  offlineTimeout?: number;
}

export class MiniverseServer {
  private store: AgentStore;
  private httpServer: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private port: number;
  private clients: Set<WebSocket> = new Set();

  constructor(config: MiniverseServerConfig = {}) {
    this.port = config.port ?? 4321;
    this.store = new AgentStore(config.offlineTimeout ?? 30000);

    this.httpServer = createServer((req, res) => this.handleHttp(req, res));
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      // Send current state immediately
      ws.send(JSON.stringify({ type: 'agents', agents: this.store.getPublicList() }));
      ws.on('close', () => this.clients.delete(ws));
    });

    this.store.onUpdate(() => this.broadcast());
  }

  async start(): Promise<number> {
    this.store.start();

    return new Promise((resolve, reject) => {
      this.httpServer.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          // Try next port
          this.port++;
          this.httpServer.listen(this.port, () => resolve(this.port));
        } else {
          reject(err);
        }
      });
      this.httpServer.listen(this.port, () => resolve(this.port));
    });
  }

  stop() {
    this.store.stop();
    for (const ws of this.clients) ws.close();
    this.wss.close();
    this.httpServer.close();
  }

  getPort(): number {
    return this.port;
  }

  private broadcast() {
    const msg = JSON.stringify({ type: 'agents', agents: this.store.getPublicList() });
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }

  private async handleHttp(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', `http://localhost:${this.port}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Routes
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(getFrontendHtml(this.port));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/agents') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ agents: this.store.getPublicList() }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/heartbeat') {
      try {
        const body = await readBody(req);
        const data = JSON.parse(body);

        if (!data.agent) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required field: agent' }));
          return;
        }

        const agent = this.store.heartbeat(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, agent: { ...agent, lastSeen: undefined } }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/agents/remove') {
      try {
        const body = await readBody(req);
        const data = JSON.parse(body);
        if (data.agent) this.store.remove(data.agent);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}
