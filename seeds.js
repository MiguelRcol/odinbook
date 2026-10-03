import { faker } from '@faker-js/faker';
import { pathToFileURL } from 'node:url';
import { hashPassword } from './src/password.js';
import { members, samplePosts } from './public/sample-data.js';

export async function seed(prisma) {
  faker.seed(42);
  const passwordHash =
    process.env.NODE_ENV === 'production' ? 'disabled' : await hashPassword('BuildSomething2026!');
  for (const member of members) {
    const { id, ...profile } = member;
    await prisma.user.upsert({
      where: { id },
      update: {},
      create: { id, ...profile, email: `${profile.username}@example.com`, passwordHash },
    });
  }
  for (const post of samplePosts) {
    const { minutes, likes, comments, ...data } = post;
    await prisma.post.upsert({
      where: { id: data.id },
      update: {},
      create: { ...data, createdAt: new Date(Date.now() - minutes * 60000) },
    });
    for (const [index, comment] of comments.entries()) {
      await prisma.comment.upsert({
        where: { id: `${data.id}-comment-${index}` },
        update: {},
        create: { id: `${data.id}-comment-${index}`, ...comment, postId: data.id },
      });
    }
    for (const member of members.filter((member) => member.id !== data.authorId)) {
      const key = { userId: member.id, postId: data.id };
      await prisma.like.upsert({ where: { userId_postId: key }, update: {}, create: key });
    }
  }
  for (const member of members) {
    for (const target of members.filter((target) => target.id !== member.id).slice(0, 3)) {
      const key = { followerId: member.id, followingId: target.id };
      await prisma.follow.upsert({
        where: { followerId_followingId: key },
        update: {},
        create: { ...key, status: 'ACCEPTED' },
      });
    }
  }
  for (let index = 0; index < 12; index++) {
    const id = `community-${index}`;
    const name = faker.person.fullName();
    await prisma.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name,
        username: `builder_${index}`,
        email: `builder${index}@example.com`,
        passwordHash,
        bio: faker.helpers.arrayElement([
          'Learning in public. Building one small thing at a time.',
          'Curious about the web, design, and everything in between.',
          'Turning coffee into code. Happy to be here.',
        ]),
        location: faker.location.city(),
        color: faker.helpers.arrayElement(['#e6dfed', '#dce5ed', '#e7e0d4', '#dce8dc']),
      },
    });
  }
  console.log('Seeded community profiles and conversations without overwriting existing data.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { createDatabase } = await import('./src/db.js');
  const database = createDatabase();
  try {
    await seed(database.prisma);
  } finally {
    await database.close();
  }
}
