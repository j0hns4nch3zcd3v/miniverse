import { build } from 'esbuild';

await build({
  entryPoints: ['src/cli.ts', 'src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outdir: 'dist',
  external: ['ws'],
  banner: {
    js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
  },
});

console.log('Build complete.');
