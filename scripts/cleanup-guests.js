import { createDatabase } from '../src/db.js';
const database = createDatabase();
try {
  const cutoff = new Date(Date.now() - 7 * 86400000);
  const result = await database.prisma.user.deleteMany({
    where: { isGuest: true, createdAt: { lt: cutoff } },
  });
  console.log(
    `Removed ${result.count} guest accounts older than seven days and their dependent records.`,
  );
} finally {
  await database.close();
}
