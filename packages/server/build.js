import { build } from 'esbuild';

await build({
  entryPoints: ['src/cli.ts', 'src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outdir: 'dist',
  external: ['ws'],
});

console.log('Build complete.');
