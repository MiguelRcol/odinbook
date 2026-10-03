import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { startLocalPostgres } from './postgres.js';
import 'dotenv/config';

if (!existsSync('.env')) {
  writeFileSync(
    '.env',
    `DATABASE_URL=postgresql://postgres:local-development-only@127.0.0.1:55432/odinbook\nSESSION_SECRET=${randomBytes(48).toString('hex')}\nPORT=3020\nAPP_ORIGIN=http://localhost:3020\nALLOW_GUEST=true\nLOCAL_POSTGRES=true\n`,
  );
  console.log('Created .env with a random session secret.');
}
const { config } = await import('dotenv');
config({ override: true, quiet: true });
let local;
try {
  if (process.env.LOCAL_POSTGRES === 'true') local = await startLocalPostgres();
  for (const args of [['generate'], ['migrate', 'deploy']]) {
    const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...args], {
      stdio: 'inherit',
    });
    if (result.status !== 0) throw new Error(`Prisma ${args.join(' ')} failed.`);
  }
  const { createDatabase } = await import('../src/db.js');
  const database = createDatabase();
  try {
    const { seed } = await import('../seeds.js');
    await seed(database.prisma);
  } finally {
    await database.close();
  }
  console.log('Setup complete. Run npm run dev, then open http://localhost:3020.');
} finally {
  if (local) await local.pg.stop();
}
