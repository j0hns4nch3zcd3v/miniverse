/**
 * Self-contained HTML frontend served by the miniverse server.
 * This is the full pixel world app — no external files needed.
 */
export function getFrontendHtml(wsPort: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Miniverse</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: #1a1a2e;
  color: #eee;
  font-family: 'Courier New', monospace;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 16px;
}
h1 { font-size: 20px; color: #e94560; letter-spacing: 4px; text-transform: uppercase; }
.subtitle { font-size: 12px; color: #666; margin-bottom: 8px; }
#miniverse-container {
  border: 2px solid #333;
  border-radius: 4px;
  overflow: hidden;
  background: #0f0f23;
  display: inline-block;
  line-height: 0;
}
.controls { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
button {
  background: #16213e;
  border: 1px solid #e94560;
  color: #e94560;
  padding: 6px 14px;
  cursor: pointer;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  border-radius: 2px;
  transition: all 0.15s;
}
button:hover { background: #e94560; color: #1a1a2e; }
#tooltip {
  position: fixed;
  background: rgba(0,0,0,0.85);
  border: 1px solid #e94560;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 11px;
  pointer-events: none;
  display: none;
  z-index: 100;
  max-width: 220px;
}
#tooltip .name { color: #e94560; font-weight: bold; }
#tooltip .state { color: #aaa; }
#tooltip .task { color: #66aaff; }
.status-bar { display: flex; gap: 16px; font-size: 11px; color: #555; flex-wrap: wrap; justify-content: center; }
.status-bar .agent { display: flex; align-items: center; gap: 4px; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: #555; display: inline-block; }
.status-dot.working { background: #4ade80; }
.status-dot.idle { background: #fbbf24; }
.status-dot.sleeping { background: #818cf8; }
.status-dot.thinking { background: #f472b6; }
.status-dot.error { background: #ef4444; }
.status-dot.speaking { background: #22d3ee; }
.status-dot.offline { background: #444; }
.onboarding {
  max-width: 500px;
  text-align: center;
  color: #555;
  font-size: 11px;
  line-height: 1.6;
}
.onboarding code {
  display: block;
  background: #16213e;
  border: 1px solid #333;
  padding: 8px 12px;
  margin: 8px 0;
  border-radius: 4px;
  text-align: left;
  font-size: 10px;
  color: #e94560;
  cursor: pointer;
  position: relative;
}
.onboarding code:hover::after {
  content: 'click to copy';
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: #666;
  font-size: 9px;
}
.copied { color: #4ade80 !important; }
</style>
</head>
<body>
<h1>Miniverse</h1>
<p class="subtitle">the anti-metaverse &mdash; a tiny pixel world for your AI agents</p>
<div id="miniverse-container"></div>
<div class="status-bar" id="status-bar"></div>
<div class="controls">
  <button onclick="triggerIntercom()">Intercom</button>
</div>
<div class="onboarding" id="onboarding">
  <p>No agents connected yet. Send a heartbeat to bring an agent to life:</p>
  <code onclick="copySnippet(this)">curl -X POST http://localhost:${wsPort}/api/heartbeat \\
  -H "Content-Type: application/json" \\
  -d '{"agent":"claude","state":"working","task":"Hello world"}'</code>
</div>
<div id="tooltip">
  <div class="name"></div>
  <div class="state"></div>
  <div class="task"></div>
</div>

<script type="module">
// ============================================================
// Miniverse Frontend — inline build (no imports, self-contained)
// ============================================================

// --- Pathfinder (A*) ---
class Pathfinder {
  constructor(grid) { this.grid = grid; this.h = grid.length; this.w = grid[0]?.length ?? 0; }
  findPath(sx, sy, ex, ey) {
    sx = Math.round(sx); sy = Math.round(sy); ex = Math.round(ex); ey = Math.round(ey);
    if (!this._ok(ex, ey)) return [];
    const open = [{ x: sx, y: sy, g: 0, h: this._h(sx,sy,ex,ey), f: this._h(sx,sy,ex,ey), p: null }];
    const closed = new Set();
    while (open.length) {
      open.sort((a,b) => a.f - b.f);
      const c = open.shift();
      if (c.x === ex && c.y === ey) return this._path(c);
      closed.add(c.x+','+c.y);
      for (const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = c.x+dx, ny = c.y+dy, nk = nx+','+ny;
        if (!this._ok(nx,ny) || closed.has(nk)) continue;
        const g = c.g+1, ex2 = open.find(n=>n.x===nx&&n.y===ny);
        if (!ex2) { const h=this._h(nx,ny,ex,ey); open.push({x:nx,y:ny,g,h,f:g+h,p:c}); }
        else if (g < ex2.g) { ex2.g=g; ex2.f=g+ex2.h; ex2.p=c; }
      }
    }
    return [];
  }
  _ok(x,y) { return x>=0&&y>=0&&y<this.h&&x<this.w&&this.grid[y][x]; }
  _h(ax,ay,bx,by) { return Math.abs(ax-bx)+Math.abs(ay-by); }
  _path(n) { const p=[]; let c=n; while(c){p.unshift({x:c.x,y:c.y});c=c.p;} return p; }
}

// --- Generate pixel art assets ---
function createCanvas(w,h) { const c=document.createElement('canvas'); c.width=w; c.height=h; return [c, c.getContext('2d')]; }
function canvasToUrl(c) { return new Promise(r => c.toBlob(b => r(URL.createObjectURL(b)))); }

async function genTileset() {
  const [c, ctx] = createCanvas(256, 64);
  for (let y=0;y<16;y++) for (let x=0;x<16;x++) {
    const n=Math.random()*15; ctx.fillStyle=\`rgb(\${180+n},\${140+n},\${100+n*.5})\`; ctx.fillRect(x,y,1,1);
  }
  ctx.fillStyle='rgba(0,0,0,0.08)'; ctx.fillRect(0,7,16,1); ctx.fillRect(0,15,16,1);
  for (let y=0;y<16;y++) for (let x=0;x<16;x++) {
    const n=Math.random()*8; ctx.fillStyle=\`rgb(\${50+n},\${55+n},\${70+n})\`; ctx.fillRect(16+x,y,1,1);
  }
  ctx.fillStyle='rgba(255,255,255,0.06)';
  ctx.fillRect(16,4,16,1); ctx.fillRect(16,8,16,1); ctx.fillRect(16,12,16,1);
  return canvasToUrl(c);
}

async function genSprite(body, hair, shirt) {
  const fw=16, fh=24, [c, ctx] = createCanvas(fw*4, fh*4);
  const dirs = ['down','up','left','right'];
  for (let row=0;row<4;row++) for (let f=0;f<4;f++) {
    const ox=f*fw, oy=row*fh, bob=f%2===0?0:-1, dir=dirs[row], lo=f%2===0?0:1;
    ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.fillRect(ox+4,oy+21+bob,8,3);
    ctx.fillStyle='#3b3b5c'; ctx.fillRect(ox+5,oy+17+bob,2,4+lo); ctx.fillRect(ox+9,oy+17+bob,2,4-lo+1);
    ctx.fillStyle='#2a2a3a'; ctx.fillRect(ox+4,oy+20+lo+bob,3,2); ctx.fillRect(ox+9,oy+21-lo+bob,3,2);
    ctx.fillStyle=shirt; ctx.fillRect(ox+4,oy+11+bob,8,7);
    ctx.fillStyle=body;
    if(dir==='left') ctx.fillRect(ox+3,oy+12+bob,2,5+lo);
    else if(dir==='right') ctx.fillRect(ox+11,oy+12+bob,2,5+lo);
    else { ctx.fillRect(ox+3,oy+12+bob,2,4+lo); ctx.fillRect(ox+11,oy+12+bob,2,4-lo+1); }
    ctx.fillStyle=body; ctx.fillRect(ox+5,oy+4+bob,6,7);
    ctx.fillStyle=hair;
    if(dir==='down'){ctx.fillRect(ox+4,oy+2+bob,8,4);ctx.fillRect(ox+4,oy+5+bob,2,2);ctx.fillRect(ox+10,oy+5+bob,2,2);}
    else if(dir==='up') ctx.fillRect(ox+4,oy+2+bob,8,5);
    else if(dir==='left'){ctx.fillRect(ox+4,oy+2+bob,8,4);ctx.fillRect(ox+4,oy+5+bob,2,4);}
    else {ctx.fillRect(ox+4,oy+2+bob,8,4);ctx.fillRect(ox+10,oy+5+bob,2,4);}
    if(dir==='down'){ctx.fillStyle='#fff';ctx.fillRect(ox+6,oy+7+bob,2,2);ctx.fillRect(ox+9,oy+7+bob,2,2);ctx.fillStyle='#1a1a2e';ctx.fillRect(ox+7,oy+7+bob,1,2);ctx.fillRect(ox+10,oy+7+bob,1,2);}
    else if(dir==='left'){ctx.fillStyle='#fff';ctx.fillRect(ox+5,oy+7+bob,2,2);ctx.fillStyle='#1a1a2e';ctx.fillRect(ox+5,oy+7+bob,1,2);}
    else if(dir==='right'){ctx.fillStyle='#fff';ctx.fillRect(ox+9,oy+7+bob,2,2);ctx.fillStyle='#1a1a2e';ctx.fillRect(ox+10,oy+7+bob,1,2);}
  }
  return canvasToUrl(c);
}

// --- Color palette for auto-assigned agents ---
const PALETTES = [
  { body:'#f4c89e', hair:'#8b4513', shirt:'#e94560' },
  { body:'#d4a574', hair:'#2a2a3a', shirt:'#16213e' },
  { body:'#f0d5a8', hair:'#c0392b', shirt:'#2ecc71' },
  { body:'#e8c39e', hair:'#8e44ad', shirt:'#3498db' },
  { body:'#f5deb3', hair:'#d35400', shirt:'#1abc9c' },
  { body:'#deb887', hair:'#2c3e50', shirt:'#e67e22' },
];

// --- Scene config ---
const COLS = 16, ROWS = 12, TW = 16, TH = 16;
function buildScene() {
  const floor = [], walkable = [];
  for (let r=0;r<ROWS;r++) { floor[r]=[]; walkable[r]=[];
    for (let c=0;c<COLS;c++) {
      if(r===0||r===ROWS-1||c===0||c===COLS-1){floor[r][c]=1;walkable[r][c]=false;}
      else{floor[r][c]=0;walkable[r][c]=true;}
    }
  }
  [[2,2],[2,3],[2,7],[2,8]].forEach(([r,c])=>walkable[r][c]=false);
  [[8,11],[8,12],[8,13]].forEach(([r,c])=>walkable[r][c]=false);
  return { floor, walkable };
}

const LOCATIONS = {
  desk_1:{x:3,y:3}, desk_2:{x:8,y:3}, desk_3:{x:3,y:5}, desk_4:{x:8,y:5},
  coffee_machine:{x:13,y:2}, couch:{x:12,y:7}, whiteboard:{x:8,y:1},
  intercom:{x:1,y:1}, center:{x:7,y:6}, lounge:{x:5,y:8},
};

const DESK_POOL = ['desk_1','desk_2','desk_3','desk_4'];

const STATE_ANIMS = {
  working:'working', idle:'idle_down', thinking:'idle_down', error:'idle_down',
  waiting:'idle_down', collaborating:'walk_down', sleeping:'sleeping',
  listening:'idle_down', speaking:'talking', offline:'idle_down'
};

const ANIM_DEFS = {
  idle_down:{row:0,frames:2,speed:0.5}, idle_up:{row:1,frames:2,speed:0.5},
  walk_down:{row:0,frames:4,speed:0.15}, walk_up:{row:1,frames:4,speed:0.15},
  walk_left:{row:2,frames:4,speed:0.15}, walk_right:{row:3,frames:4,speed:0.15},
  working:{row:0,frames:2,speed:0.3}, sleeping:{row:0,frames:2,speed:0.8},
  talking:{row:0,frames:4,speed:0.12},
};

// --- Resident class ---
class Resident {
  constructor(id, name, img, deskLoc) {
    this.id = id; this.name = name; this.img = img;
    this.state = 'idle'; this.task = null; this.energy = 1; this.visible = true;
    this.x = 0; this.y = 0; this.anim = 'idle_down'; this.frame = 0; this.elapsed = 0;
    this.path = []; this.pathIdx = 0; this.moveProg = 0; this.deskLoc = deskLoc;
    this.idleTimer = 3 + Math.random() * 5;
    const loc = LOCATIONS[deskLoc];
    if (loc) { this.x = loc.x * TW; this.y = loc.y * TH; }
  }
  tile() { return { x: Math.round(this.x/TW), y: Math.round(this.y/TH) }; }
  playAnim(a) { if(this.anim===a)return; this.anim=a; this.frame=0; this.elapsed=0; }
  walkTo(path) { if(path.length<=1)return; this.path=path; this.pathIdx=1; this.moveProg=0; }
  isMoving() { return this.pathIdx < this.path.length; }

  updateState(state, task, energy) {
    const prev = this.state;
    this.state = state; this.task = task; this.energy = energy;
    this.visible = state !== 'offline';
    if (prev !== state && !this.isMoving()) this.playAnim(STATE_ANIMS[state] ?? 'idle_down');
    return prev !== state;
  }

  update(dt, pf) {
    if (this.isMoving()) {
      const t = this.path[this.pathIdx], tx=t.x*TW, ty=t.y*TH;
      const dx=tx-this.x, dy=ty-this.y;
      if(Math.abs(dx)>Math.abs(dy)) this.playAnim(dx>0?'walk_right':'walk_left');
      else this.playAnim(dy>0?'walk_down':'walk_up');
      this.moveProg += dt * 2;
      if (this.moveProg >= 1) {
        this.x=tx; this.y=ty; this.moveProg=0; this.pathIdx++;
        if (this.pathIdx>=this.path.length) { this.path=[]; this.pathIdx=0; this.playAnim(STATE_ANIMS[this.state]??'idle_down'); }
      } else {
        const p=this.path[this.pathIdx-1]; this.x=p.x*TW+(tx-p.x*TW)*this.moveProg; this.y=p.y*TH+(ty-p.y*TH)*this.moveProg;
      }
    } else if (this.state === 'idle') {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) {
        this.idleTimer = 5 + Math.random() * 8;
        const locs = Object.keys(LOCATIONS);
        const target = LOCATIONS[locs[Math.floor(Math.random()*locs.length)]];
        const t = this.tile();
        const path = pf.findPath(t.x, t.y, target.x, target.y);
        if (path.length > 1) this.walkTo(path);
      }
    }
    // Animate
    const ad = ANIM_DEFS[this.anim]; if(!ad)return;
    this.elapsed += dt;
    if (this.elapsed >= ad.speed) { this.elapsed -= ad.speed; this.frame = (this.frame+1) % ad.frames; }
  }

  draw(ctx) {
    if (!this.visible || !this.img) return;
    const ad = ANIM_DEFS[this.anim]; if(!ad)return;
    const sx = this.frame * 16, sy = ad.row * 24;
    const drawX = this.x + (TW-16)/2, drawY = this.y + (TH-24);
    ctx.drawImage(this.img, sx, sy, 16, 24, drawX, drawY, 16, 24);
    // Name tag
    ctx.save();
    ctx.font = '4px monospace';
    const nw = ctx.measureText(this.name).width;
    const nx = this.x + (TW-nw)/2, ny = drawY - 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(nx-1, ny-4, nw+2, 6);
    ctx.fillStyle = '#fff';
    ctx.fillText(this.name, nx, ny);
    ctx.restore();
  }

  containsPoint(px, py) {
    const dx = this.x+(TW-16)/2, dy = this.y+(TH-24);
    return px>=dx && px<=dx+16 && py>=dy && py<=dy+24;
  }
}

// --- Particles ---
const particles = [];
function emitParticle(x,y,text,vy=-0.5,life=2,size=6) {
  particles.push({x:x+Math.random()*8,y,vx:0.2+Math.random()*0.3,vy,life,maxLife:life,text,size,alpha:1});
}
function updateParticles(dt) {
  for (const p of particles) { p.x+=p.vx*dt*10; p.y+=p.vy*dt*10; p.life-=dt; p.alpha=Math.max(0,p.life/p.maxLife); }
  for (let i=particles.length-1;i>=0;i--) if(particles[i].life<=0) particles.splice(i,1);
}
function drawParticles(ctx) {
  for (const p of particles) {
    ctx.save(); ctx.globalAlpha=p.alpha; ctx.fillStyle='#fff'; ctx.strokeStyle='#000'; ctx.lineWidth=0.5;
    ctx.font='bold '+p.size+'px monospace'; ctx.strokeText(p.text,p.x,p.y); ctx.fillText(p.text,p.x,p.y); ctx.restore();
  }
}

// --- Main ---
const container = document.getElementById('miniverse-container');
const tooltip = document.getElementById('tooltip');
const statusBar = document.getElementById('status-bar');
const onboarding = document.getElementById('onboarding');
const canvas = document.createElement('canvas');
const W = 256, H = 192, SCALE = 3;
canvas.width = W; canvas.height = H;
canvas.style.width = W*SCALE+'px'; canvas.style.height = H*SCALE+'px';
canvas.style.imageRendering = 'pixelated';
container.appendChild(canvas);
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const {floor, walkable} = buildScene();
const pf = new Pathfinder(walkable);

// Tileset + objects drawn directly
let tileImg = null;
genTileset().then(url => { tileImg = new Image(); tileImg.src = url; });

// Agent sprite cache
const spriteCache = new Map(); // agentId -> HTMLImageElement
const spritePromises = new Map();
let paletteIdx = 0;

async function getSpriteForAgent(agentId, color) {
  if (spriteCache.has(agentId)) return spriteCache.get(agentId);
  if (spritePromises.has(agentId)) return spritePromises.get(agentId);

  const p = PALETTES[paletteIdx % PALETTES.length];
  paletteIdx++;

  const promise = genSprite(p.body, p.hair, p.shirt).then(url => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => { spriteCache.set(agentId, img); resolve(img); };
      img.src = url;
    });
  });
  spritePromises.set(agentId, promise);
  return promise;
}

// Residents
const residents = new Map(); // agentId -> Resident
let deskIdx = 0;
const particleTimers = new Map();

function getOrCreateResident(agentData) {
  if (residents.has(agentData.agent)) return residents.get(agentData.agent);
  const desk = DESK_POOL[deskIdx % DESK_POOL.length];
  deskIdx++;
  const r = new Resident(agentData.agent, agentData.name || agentData.agent, null, desk);
  residents.set(agentData.agent, r);

  getSpriteForAgent(agentData.agent, agentData.color).then(img => { r.img = img; });

  return r;
}

// --- WebSocket connection ---
const WS_URL = 'ws://' + location.host + '/ws';
let ws = null;

function connectWs() {
  ws = new WebSocket(WS_URL);
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'agents') handleAgentUpdate(msg.agents);
    } catch {}
  };
  ws.onclose = () => setTimeout(connectWs, 2000);
  ws.onerror = () => {};
}
connectWs();

function handleAgentUpdate(agents) {
  if (agents.length > 0) onboarding.style.display = 'none';
  else onboarding.style.display = '';

  for (const a of agents) {
    const r = getOrCreateResident(a);
    const changed = r.updateState(a.state, a.task, a.energy ?? 1);
    if (changed) handleTransition(r, a.state);
  }

  // Status bar
  statusBar.innerHTML = agents.map(a =>
    '<div class="agent"><span class="status-dot '+a.state+'"></span>'+
    (a.name||a.agent)+': '+a.state+(a.task?' - '+a.task:'')+'</div>'
  ).join('');
}

function handleTransition(r, state) {
  if (state === 'sleeping' && LOCATIONS.couch) {
    const t = r.tile();
    const path = pf.findPath(t.x,t.y,LOCATIONS.couch.x,LOCATIONS.couch.y);
    if (path.length > 1) r.walkTo(path);
  } else if (state === 'working') {
    const home = LOCATIONS[r.deskLoc];
    if (home) { const t=r.tile(); const path=pf.findPath(t.x,t.y,home.x,home.y); if(path.length>1) r.walkTo(path); }
  } else if (state === 'error') {
    emitParticle(r.x+8, r.y, '!', -0.3, 1.5, 8);
  }
}

// --- Interactive objects (drawn manually) ---
function drawObjects(ctx) {
  // Intercom
  ctx.fillStyle='#666'; ctx.fillRect(18,4,8,10);
  ctx.fillStyle='#aaa'; ctx.fillRect(19,5,6,8);
  // Whiteboard
  ctx.fillStyle='#eee'; ctx.fillRect(120,2,30,14);
  ctx.strokeStyle='#999'; ctx.lineWidth=0.5; ctx.strokeRect(120,2,30,14);
  // Coffee machine
  ctx.fillStyle='#8B4513'; ctx.fillRect(210,20,10,14);
  ctx.fillStyle='#654321'; ctx.fillRect(212,22,6,10);
  // Couch
  ctx.fillStyle='#4a3728'; ctx.fillRect(176,128,32,10);
  ctx.fillStyle='#5c4033'; ctx.fillRect(177,129,30,8);
  // Desks
  ctx.fillStyle='#5c4a3a';
  ctx.fillRect(32,32,24,14); ctx.fillRect(112,32,24,14);
  // Monitor glow for working agents
  for (const r of residents.values()) {
    if (r.state === 'working' && r.visible) {
      const home = LOCATIONS[r.deskLoc];
      if (home) {
        ctx.save();
        ctx.shadowColor='#66aaff'; ctx.shadowBlur=3;
        ctx.fillStyle='rgba(100,170,255,0.2)';
        ctx.fillRect(home.x*TW-4, (home.y-1)*TH+2, 10, 8);
        ctx.restore();
      }
    }
  }
}

// --- Render loop ---
let lastTime = performance.now();
function loop(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,W,H);

  // Draw tiles
  if (tileImg) {
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      const tid = floor[r][c];
      ctx.drawImage(tileImg, tid*16, 0, 16, 16, c*TW, r*TH, TW, TH);
    }
  }

  drawObjects(ctx);

  // Update & draw residents (y-sorted)
  const sorted = [...residents.values()].sort((a,b)=>a.y-b.y);
  for (const r of sorted) { r.update(dt, pf); r.draw(ctx); }

  // Particle effects
  for (const r of residents.values()) {
    const t = (particleTimers.get(r.id) ?? 0) + dt;
    particleTimers.set(r.id, t);
    if (r.state === 'sleeping' && t > 1.5) { particleTimers.set(r.id, 0); emitParticle(r.x+8, r.y, 'Z'); }
    if (r.state === 'thinking' && t > 2) { particleTimers.set(r.id, 0); emitParticle(r.x+8, r.y, '...', -0.2, 2, 5); }
    if (r.state === 'error' && t > 2) { particleTimers.set(r.id, 0); emitParticle(r.x+8, r.y, '!', -0.3, 1.5, 8); }
  }
  updateParticles(dt);
  drawParticles(ctx);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// --- Click handling ---
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) / SCALE;
  const py = (e.clientY - rect.top) / SCALE;
  for (const r of residents.values()) {
    if (r.containsPoint(px, py)) {
      tooltip.style.display = 'block';
      tooltip.querySelector('.name').textContent = r.name;
      tooltip.querySelector('.state').textContent = 'State: ' + r.state;
      tooltip.querySelector('.task').textContent = r.task ? 'Task: ' + r.task : 'No active task';
      setTimeout(() => { tooltip.style.display = 'none'; }, 3000);
      return;
    }
  }
  tooltip.style.display = 'none';
});
canvas.addEventListener('mousemove', (e) => {
  tooltip.style.left = e.clientX+12+'px';
  tooltip.style.top = e.clientY+12+'px';
});

// --- Intercom ---
window.triggerIntercom = () => {
  for (const r of residents.values()) {
    if (r.visible) r.playAnim('idle_down');
  }
};

// --- Copy snippet ---
window.copySnippet = (el) => {
  navigator.clipboard.writeText(el.textContent).then(() => {
    el.classList.add('copied');
    setTimeout(() => el.classList.remove('copied'), 1500);
  });
};
</script>
</body>
</html>`;
}
