import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
if (process.argv.includes('--demo'))
  await writeFile('dist/config.js', 'export const DEMO = true;\n');
console.log(
  process.argv.includes('--demo')
    ? 'Built the clearly labeled browser-only portfolio demo.'
    : 'Built production assets. Express serves public/ directly.',
);
