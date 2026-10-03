import express from 'express';
import path from 'node:path';
const app = express();
app.use('/odinbook', express.static(path.resolve('dist')));
const server = app.listen(8088, '127.0.0.1', () =>
  console.log('Portfolio sandbox at http://localhost:8088/odinbook/'),
);
process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
