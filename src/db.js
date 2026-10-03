import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

export function createDatabase(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is missing. Run npm run setup first.');
  const pool = new pg.Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 5000 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  return {
    prisma,
    pool,
    close: async () => {
      await prisma.$disconnect();
      await pool.end();
    },
  };
}
