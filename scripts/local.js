import 'dotenv/config';
import { startLocalPostgres } from './postgres.js';
import { createDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
let local;
if (process.env.LOCAL_POSTGRES === 'true') local = await startLocalPostgres();
const database = createDatabase();
const server = createApp(database).listen(Number(process.env.PORT || 3020), () =>
  console.log(`Odinbook is ready at http://localhost:${process.env.PORT || 3020}`),
);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  server.close(async () => {
    await database.close();
    if (local) await local.pg.stop();
    process.exit(0);
  });
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
