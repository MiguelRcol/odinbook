import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`],
      ),
    )
  ).flat();
}
for (const file of [
  'seeds.js',
  ...(await Promise.all(['src', 'scripts', 'public', 'tests'].map(walk))).flat(),
].filter((file) => file.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status);
}
const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'validate'], {
  stdio: 'inherit',
});
process.exitCode = result.status;
