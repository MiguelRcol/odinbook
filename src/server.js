import 'dotenv/config';
import { createDatabase } from './db.js';
import { createApp } from './app.js';
const database = createDatabase();
const app = createApp(database);
const server = app.listen(Number(process.env.PORT || 3020), () =>
  console.log(`Odinbook is ready at http://localhost:${process.env.PORT || 3020}`),
);
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  server.close(async () => {
    await database.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
