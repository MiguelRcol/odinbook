import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import path from 'node:path';
export async function startLocalPostgres({
  port = 55432,
  directory = 'data/postgres-utf8',
  persistent = true,
} = {}) {
  const databaseDir = path.resolve(directory);
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'local-development-only',
    port,
    persistent,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    postgresFlags: ['-h', '127.0.0.1'],
    onLog: () => {},
    onError: (message) => {
      if (String(message).includes('FATAL')) console.error(String(message));
    },
  });
  if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) await pg.initialise();
  await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  const { rows } = await client.query("SELECT 1 FROM pg_database WHERE datname = 'odinbook'");
  await client.end();
  if (!rows.length) await pg.createDatabase('odinbook');
  return { pg, url: `postgresql://postgres:local-development-only@127.0.0.1:${port}/odinbook` };
}
