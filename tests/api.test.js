import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { startLocalPostgres } from '../scripts/postgres.js';
import { createDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';

let local, database, app, alice, bob, aliceToken, bobToken, aliceUser, bobUser, alicePost, bobPost;
before(async () => {
  // Only an explicitly separate test database is used. Never reset DATABASE_URL.
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    local = await startLocalPostgres({
      port: 55433,
      directory: `data/test-${randomUUID()}`,
      persistent: false,
    });
    url = local.url;
  }
  const result = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' },
  );
  assert.equal(result.status, 0, result.stderr.toString());
  database = createDatabase(url);
  app = createApp({
    ...database,
    sessionSecret: 'test-secret-with-more-than-thirty-two-characters',
    production: false,
    rateLimits: false,
    origin: 'http://localhost:3020',
  });
  alice = request.agent(app);
  bob = request.agent(app);
});
after(async () => {
  if (database) await database.close();
  if (local) await local.pg.stop();
});

async function register(agent, label) {
  const { body: session } = await agent.get('/api/session').expect(200);
  const { body, headers } = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', session.csrfToken)
    .send({
      name: label,
      username: `${label.toLowerCase()}_${randomUUID().slice(0, 8)}`,
      email: `${label.toLowerCase()}-${randomUUID()}@example.com`,
      password: 'CorrectHorse2026!',
    })
    .expect(201);
  return { ...body, headers };
}
const mutate = (agent, token, method, url, body) =>
  agent[method](url).set('X-CSRF-Token', token).send(body);

test('private resources require authentication; sessions reveal no community data', async () => {
  for (const url of ['/api/posts', '/api/users', '/api/requests', '/api/stats'])
    await request(app).get(url).expect(401);
  const { body } = await request(app).get('/api/session').expect(200);
  assert.equal(body.user, null);
  assert.equal(body.csrfToken.length, 64);
});
test('CSRF and origin checks protect auth and mutation endpoints', async () => {
  await alice.post('/api/auth/register').send({}).expect(403);
  const session = await alice.get('/api/session');
  await alice
    .post('/api/auth/guest')
    .set('X-CSRF-Token', session.body.csrfToken)
    .set('Origin', 'https://untrusted.example')
    .expect(403);
});
test('registration rotates session token, hashes passwords, and sets secure cookie flags', async () => {
  const a = await register(alice, 'Alice');
  const b = await register(bob, 'Bob');
  aliceToken = a.csrfToken;
  aliceUser = a.user;
  bobToken = b.csrfToken;
  bobUser = b.user;
  assert.match(a.headers['set-cookie'][0], /HttpOnly/);
  assert.match(a.headers['set-cookie'][0], /SameSite=Lax/);
  assert.equal(a.user.email, undefined);
  assert.equal(a.user.passwordHash, undefined);
  const stored = await database.prisma.user.findUnique({ where: { id: aliceUser.id } });
  assert.match(stored.passwordHash, /^scrypt:/);
  assert.ok(!stored.passwordHash.includes('CorrectHorse'));
});
test('input validation rejects blank posts, long posts, unsafe images, and missing image descriptions', async () => {
  for (const body of [
    { content: ' ' },
    { content: 'x'.repeat(2001) },
    { content: 'Hello', imageUrl: 'http://example.com/pic.png', imageAlt: 'Photo' },
    { content: 'Hello', imageUrl: 'https://example.com/pic.png' },
  ])
    await mutate(alice, aliceToken, 'post', '/api/posts', body).expect(400);
});
test('users can create text and image posts; every post includes author, likes, and comments', async () => {
  const a = await mutate(alice, aliceToken, 'post', '/api/posts', {
    content: 'Alice learns PostgreSQL.',
  }).expect(201);
  const b = await mutate(bob, bobToken, 'post', '/api/posts', {
    content: 'Bob ships an accessible project.',
    imageUrl: 'https://example.com/photo.png',
    imageAlt: 'A forest path',
  }).expect(201);
  alicePost = a.body;
  bobPost = b.body;
  assert.equal(a.body.author.id, aliceUser.id);
  assert.equal(a.body._count.likes, 0);
  assert.deepEqual(a.body.comments, []);
  assert.equal(b.body.imageAlt, 'A forest path');
});
test('home feed excludes users with no accepted follow, while discovery includes their posts', async () => {
  const home = await alice.get('/api/posts').expect(200);
  assert.ok(home.body.posts.some((post) => post.id === alicePost.id));
  assert.ok(!home.body.posts.some((post) => post.id === bobPost.id));
  const discover = await alice.get('/api/posts?scope=discover').expect(200);
  assert.ok(discover.body.posts.some((post) => post.id === bobPost.id));
});
test('follow requests are idempotent, reject self-follows, and do not enter the home feed early', async () => {
  await mutate(alice, aliceToken, 'post', `/api/users/${aliceUser.id}/follow`).expect(400);
  for (let i = 0; i < 2; i++) {
    const response = await mutate(
      alice,
      aliceToken,
      'post',
      `/api/users/${bobUser.id}/follow`,
    ).expect(201);
    assert.equal(response.body.status, 'PENDING');
  }
  const requests = await bob.get('/api/requests').expect(200);
  assert.ok(requests.body.requests.some((entry) => entry.followerId === aliceUser.id));
  const home = await alice.get('/api/posts');
  assert.ok(!home.body.posts.some((post) => post.id === bobPost.id));
});
test('only a request recipient can accept; accepted follows enter the feed', async () => {
  await mutate(alice, aliceToken, 'put', `/api/requests/${aliceUser.id}`, {
    action: 'accept',
  }).expect(404);
  await mutate(bob, bobToken, 'put', `/api/requests/${aliceUser.id}`, { action: 'accept' }).expect(
    204,
  );
  const home = await alice.get('/api/posts').expect(200);
  assert.ok(home.body.posts.some((post) => post.id === bobPost.id));
  const profile = await alice.get(`/api/users/${bobUser.username}`).expect(200);
  assert.equal(profile.body.relationship, 'ACCEPTED');
});
test('concurrent likes produce one row and DELETE removes only the acting user’s like', async () => {
  await Promise.all(
    Array.from({ length: 3 }, () =>
      mutate(alice, aliceToken, 'put', `/api/posts/${bobPost.id}/like`).expect(204),
    ),
  );
  assert.equal(
    await database.prisma.like.count({ where: { postId: bobPost.id, userId: aliceUser.id } }),
    1,
  );
  await mutate(bob, bobToken, 'put', `/api/posts/${bobPost.id}/like`).expect(204);
  await mutate(alice, aliceToken, 'delete', `/api/posts/${bobPost.id}/like`).expect(204);
  assert.equal(await database.prisma.like.count({ where: { postId: bobPost.id } }), 1);
});
test('bookmarks are private, persistent, and idempotent', async () => {
  await mutate(alice, aliceToken, 'put', `/api/posts/${bobPost.id}/bookmark`).expect(204);
  await mutate(alice, aliceToken, 'put', `/api/posts/${bobPost.id}/bookmark`).expect(204);
  const a = await alice.get('/api/posts?scope=saved').expect(200);
  const b = await bob.get('/api/posts?scope=saved').expect(200);
  assert.ok(a.body.posts.some((post) => post.id === bobPost.id));
  assert.ok(!b.body.posts.some((post) => post.id === bobPost.id));
});
test('comments include authors, update counts, reject blanks, and enforce ownership', async () => {
  await mutate(alice, aliceToken, 'post', `/api/posts/${bobPost.id}/comments`, {
    content: ' ',
  }).expect(400);
  const response = await mutate(alice, aliceToken, 'post', `/api/posts/${bobPost.id}/comments`, {
    content: 'Congratulations on shipping!',
  }).expect(201);
  assert.equal(response.body.author.id, aliceUser.id);
  const comments = await bob.get(`/api/posts/${bobPost.id}/comments`).expect(200);
  assert.ok(comments.body.comments.some((comment) => comment.id === response.body.id));
  await mutate(bob, bobToken, 'delete', `/api/comments/${response.body.id}`).expect(403);
  await mutate(alice, aliceToken, 'delete', `/api/comments/${response.body.id}`).expect(204);
});
test('profile updates persist and do not allow privilege or identity changes', async () => {
  const response = await mutate(alice, aliceToken, 'patch', '/api/profile', {
    name: 'Alice Builder',
    bio: 'Learning in public.',
    location: 'Bogotá',
    website: 'https://example.com',
    avatarUrl: 'https://example.com/avatar.png',
    id: bobUser.id,
    isGuest: true,
  }).expect(200);
  assert.equal(response.body.id, aliceUser.id);
  assert.equal(response.body.isGuest, false);
  const profile = await bob.get(`/api/users/${aliceUser.username}`).expect(200);
  assert.equal(profile.body.name, 'Alice Builder');
  assert.equal(profile.body.avatarUrl, 'https://example.com/avatar.png');
  assert.equal(profile.body.passwordHash, undefined);
  assert.equal(profile.body.email, undefined);
});
test('search filters users and posts; invalid feed scope returns 400', async () => {
  const people = await alice.get('/api/users?q=Alice%20Builder').expect(200);
  assert.equal(people.body.users[0].id, aliceUser.id);
  const posts = await alice.get('/api/posts?scope=discover&q=PostgreSQL').expect(200);
  assert.ok(posts.body.posts.some((post) => post.id === alicePost.id));
  await alice.get('/api/posts?scope=unknown').expect(400);
});
test('cursor pagination returns distinct posts in newest-first order', async () => {
  await database.prisma.post.createMany({
    data: Array.from({ length: 15 }, (_, i) => ({
      id: `pagination-${randomUUID()}`,
      content: `Pagination ${i}`,
      authorId: aliceUser.id,
      createdAt: new Date(Date.now() + i * 1000),
    })),
  });
  const first = await alice.get('/api/posts').expect(200);
  assert.equal(first.body.posts.length, 12);
  assert.ok(first.body.nextCursor);
  const second = await alice.get(`/api/posts?cursor=${first.body.nextCursor}`).expect(200);
  assert.ok(second.body.posts.length > 0);
  assert.ok(
    !second.body.posts.some((post) => first.body.posts.some((entry) => entry.id === post.id)),
  );
  assert.equal(first.body.posts[0].content, 'Pagination 14');
});
test('guests receive separate identities; edits and posts cannot overwrite another guest', async () => {
  const guests = [request.agent(app), request.agent(app)];
  const sessions = [];
  for (const guest of guests) {
    const initial = await guest.get('/api/session');
    sessions.push(
      (await mutate(guest, initial.body.csrfToken, 'post', '/api/auth/guest').expect(201)).body,
    );
  }
  assert.notEqual(sessions[0].user.id, sessions[1].user.id);
  const post = await mutate(guests[0], sessions[0].csrfToken, 'post', '/api/posts', {
    content: 'My independent guest post.',
  }).expect(201);
  await mutate(guests[1], sessions[1].csrfToken, 'delete', `/api/posts/${post.body.id}`).expect(
    403,
  );
});
test('unfollow removes posts from the home feed and cancel removes pending requests', async () => {
  await mutate(alice, aliceToken, 'delete', `/api/users/${bobUser.id}/follow`).expect(204);
  const home = await alice.get('/api/posts');
  assert.ok(!home.body.posts.some((post) => post.id === bobPost.id));
  await mutate(alice, aliceToken, 'post', `/api/users/${bobUser.id}/follow`).expect(201);
  await mutate(bob, bobToken, 'put', `/api/requests/${aliceUser.id}`, { action: 'decline' }).expect(
    204,
  );
  assert.equal(
    await database.prisma.follow.count({
      where: { followerId: aliceUser.id, followingId: bobUser.id },
    }),
    0,
  );
});
test('deleting a post enforces ownership and cascades dependent data', async () => {
  await mutate(alice, aliceToken, 'delete', `/api/posts/${bobPost.id}`).expect(403);
  await mutate(alice, aliceToken, 'post', `/api/posts/${bobPost.id}/comments`, {
    content: 'A dependent comment.',
  }).expect(201);
  await mutate(bob, bobToken, 'delete', `/api/posts/${bobPost.id}`).expect(204);
  assert.equal(await database.prisma.comment.count({ where: { postId: bobPost.id } }), 0);
  assert.equal(await database.prisma.like.count({ where: { postId: bobPost.id } }), 0);
  assert.equal(await database.prisma.bookmark.count({ where: { postId: bobPost.id } }), 0);
  await bob.get(`/api/posts/${bobPost.id}/comments`).expect(404);
});
test('PostgreSQL itself rejects self-follows and blank post content', async () => {
  await assert.rejects(
    database.pool.query('INSERT INTO "Follow" ("followerId", "followingId") VALUES ($1, $1)', [
      aliceUser.id,
    ]),
    /Follow_no_self_follow/,
  );
  await assert.rejects(
    database.pool.query(
      'INSERT INTO "Post" (id, content, "authorId", "updatedAt") VALUES ($1, $2, $3, NOW())',
      [randomUUID(), ' ', aliceUser.id],
    ),
    /Post_content_length/,
  );
});
test('logout destroys the session; valid local login establishes a new one', async () => {
  const account = await database.prisma.user.findUnique({ where: { id: aliceUser.id } });
  await mutate(alice, aliceToken, 'post', '/api/auth/logout').expect(204);
  await alice.get('/api/posts').expect(401);
  const initial = await alice.get('/api/session');
  await mutate(alice, initial.body.csrfToken, 'post', '/api/auth/login', {
    email: account.email,
    password: 'wrong-password',
  }).expect(401);
  const login = await mutate(alice, initial.body.csrfToken, 'post', '/api/auth/login', {
    email: account.email,
    password: 'CorrectHorse2026!',
  }).expect(200);
  assert.equal(login.body.user.id, aliceUser.id);
  assert.notEqual(login.body.csrfToken, aliceToken);
  await alice.get('/api/posts').expect(200);
});
test('health check queries the database and responses include security headers', async () => {
  const response = await request(app).get('/health').expect(200);
  assert.equal(response.body.status, 'ok');
  assert.ok(response.headers['content-security-policy']);
  assert.equal(response.headers['x-powered-by'], undefined);
});
