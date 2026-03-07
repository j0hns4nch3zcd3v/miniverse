#!/usr/bin/env node
import { MiniverseServer } from './server.js';

const args = process.argv.slice(2);

// Handle `miniverse report <state>` subcommand for use in hooks
if (args[0] === 'report') {
  const state = args[1] ?? 'idle';
  const taskIdx = args.indexOf('--task');
  const task = taskIdx >= 0 ? args[taskIdx + 1] : null;
  const agentIdx = args.indexOf('--agent');
  const agent = agentIdx >= 0 ? args[agentIdx + 1] : 'claude';
  const portIdx = args.indexOf('--port');
  const port = portIdx >= 0 ? args[portIdx + 1] : '4321';

  const body = JSON.stringify({ agent, state, task });

  await fetch(`http://localhost:${port}/api/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {
    // Silent fail — don't break the agent's workflow
  });

  process.exit(0);
}

// Main server mode
const portIdx = args.indexOf('--port');
const port = portIdx >= 0 ? parseInt(args[portIdx + 1], 10) : 4321;
const noBrowser = args.includes('--no-browser');

const server = new MiniverseServer({ port });

server.start().then(async (actualPort) => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║           M I N I V E R S E          ║');
  console.log('  ╠══════════════════════════════════════╣');
  console.log(`  ║  Pixel world:  http://localhost:${actualPort}  ║`);
  console.log(`  ║  Heartbeat:    POST /api/heartbeat   ║`);
  console.log(`  ║  Agents:       GET  /api/agents      ║`);
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
  console.log('  Send a heartbeat to bring an agent to life:');
  console.log('');
  console.log(`  curl -X POST http://localhost:${actualPort}/api/heartbeat \\`);
  console.log('    -H "Content-Type: application/json" \\');
  console.log(`    -d '{"agent":"claude","state":"working","task":"Hello world"}'`);
  console.log('');

  if (!noBrowser) {
    // Open browser
    const { exec } = await import('node:child_process');
    const url = `http://localhost:${actualPort}`;
    const cmd = process.platform === 'darwin' ? `open "${url}"`
      : process.platform === 'win32' ? `start "${url}"`
      : `xdg-open "${url}"`;
    exec(cmd, () => {});
  }
}).catch((err) => {
  console.error('Failed to start Miniverse server:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down Miniverse...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.stop();
  process.exit(0);
});
