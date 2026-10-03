import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Passport } from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { hashPassword, verifyPassword } from './password.js';

export const publicUser = {
  id: true,
  username: true,
  name: true,
  bio: true,
  location: true,
  website: true,
  avatarUrl: true,
  color: true,
  isGuest: true,
  createdAt: true,
};
const text = (max) => z.string().trim().min(1).max(max);
const image = z
  .string()
  .max(2000)
  .refine((value) => !value || isHttps(value), 'Use a valid HTTPS image URL.')
  .default('');
function isHttps(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}
const postInput = z.object({
  content: text(2000),
  imageUrl: image,
  imageAlt: z.string().trim().max(200).default(''),
});
const profileInput = z.object({
  name: text(60),
  bio: z.string().trim().max(280),
  location: z.string().trim().max(80),
  website: image,
  avatarUrl: image,
});
const registerInput = z.object({
  name: text(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/),
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(128),
});
const pageSize = 12;
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (status, message) => Object.assign(new Error(message), { status });

export function createApp({
  prisma,
  pool,
  sessionSecret = process.env.SESSION_SECRET,
  production = process.env.NODE_ENV === 'production',
  allowGuest = process.env.ALLOW_GUEST !== 'false',
  origin = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL,
  rateLimits = true,
}) {
  if (!sessionSecret || sessionSecret.length < 32)
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  const app = express();
  app.disable('x-powered-by');
  if (production) app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'https:', 'data:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          upgradeInsecureRequests: production ? [] : null,
        },
      },
    }),
  );
  app.use(express.json({ limit: '24kb' }));
  const Store = connectPgSimple(session);
  app.use(
    session({
      name: 'odinbook.sid',
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: new Store({ pool, tableName: 'Session', createTableIfMissing: false }),
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: production,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }),
  );
  const passport = new Passport();
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        // Equal-cost verification prevents a cheap account enumeration path.
        const valid = await verifyPassword(
          password,
          user?.passwordHash || 'scrypt:00000000000000000000000000000000:' + '00'.repeat(64),
        );
        done(null, user && !user.isGuest && valid ? user : false);
      } catch (error) {
        done(error);
      }
    }),
  );
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      done(null, await prisma.user.findUnique({ where: { id }, select: publicUser }));
    } catch (error) {
      done(error);
    }
  });
  app.use(passport.initialize());
  app.use(passport.session());
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get(
    '/health',
    asyncRoute(async (_req, res) => {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok' });
    }),
  );
  app.get('/api/session', (req, res) => {
    req.session.csrf ||= randomBytes(32).toString('hex');
    res.json({ user: req.user || null, csrfToken: req.session.csrf, allowGuest });
  });
  app.use('/api', (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const expected = req.session.csrf;
    const supplied = req.get('X-CSRF-Token');
    if (origin && req.get('origin') && req.get('origin') !== origin)
      return next(fail(403, 'This request came from an untrusted origin.'));
    if (
      !expected ||
      !supplied ||
      Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
    )
      return next(fail(403, 'Your session expired. Refresh the page and try again.'));
    next();
  });
  const authLimit = rateLimits
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 25,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
      })
    : (_req, _res, next) => next();
  const login = (req, user) =>
    new Promise((resolve, reject) =>
      req.logIn(user, (error) => {
        if (error) return reject(error);
        req.session.csrf = randomBytes(32).toString('hex');
        req.session.save((saveError) => (saveError ? reject(saveError) : resolve()));
      }),
    );
  const loginResponse = async (req, res, user, status = 200) => {
    await login(req, user);
    res.status(status).json({
      user: await prisma.user.findUnique({ where: { id: user.id }, select: publicUser }),
      csrfToken: req.session.csrf,
    });
  };
  app.post('/api/auth/login', authLimit, (req, res, next) => {
    const input = z
      .object({ email: z.email().max(254), password: z.string().min(1).max(128) })
      .safeParse(req.body);
    if (!input.success) return next(fail(400, 'Enter a valid email and password.'));
    passport.authenticate('local', (error, user) => {
      if (error) return next(error);
      if (!user) return next(fail(401, 'Email or password is incorrect.'));
      loginResponse(req, res, user).catch(next);
    })(req, res, next);
  });
  app.post(
    '/api/auth/register',
    authLimit,
    asyncRoute(async (req, res) => {
      const data = registerInput.parse(req.body);
      data.passwordHash = await hashPassword(data.password);
      delete data.password;
      const user = await prisma.user.create({ data });
      await loginResponse(req, res, user, 201);
    }),
  );
  app.post(
    '/api/auth/guest',
    authLimit,
    asyncRoute(async (req, res) => {
      if (!allowGuest) throw fail(403, 'Guest access is currently disabled.');
      const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
      const builders = await prisma.user.findMany({
        where: { isGuest: false },
        select: { id: true },
        take: 6,
        orderBy: { createdAt: 'asc' },
      });
      const user = await prisma.user.create({
        data: {
          name: 'Alex Morgan',
          username: `guest_${suffix}`,
          email: `${suffix}@guest.odinbook.invalid`,
          passwordHash: 'disabled',
          isGuest: true,
          bio: 'Curious by default. Building something, learning something.',
          location: 'Somewhere on the internet',
          following: {
            create: builders.map((builder) => ({ followingId: builder.id, status: 'ACCEPTED' })),
          },
        },
      });
      await loginResponse(req, res, user, 201);
    }),
  );
  app.use('/api', (req, _res, next) =>
    req.isAuthenticated() ? next() : next(fail(401, 'Sign in to join the conversation.')),
  );
  app.post('/api/auth/logout', (req, res, next) => {
    req.logout((error) => {
      if (error) return next(error);
      req.session.destroy((destroyError) => {
        if (destroyError) return next(destroyError);
        res.clearCookie('odinbook.sid', { httpOnly: true, sameSite: 'lax', secure: production });
        res.status(204).end();
      });
    });
  });
  if (rateLimits)
    app.use(
      '/api',
      rateLimit({
        windowMs: 60 * 1000,
        limit: 120,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { error: 'A little too fast. Try again in a moment.' },
      }),
    );

  const postInclude = (userId) => ({
    author: { select: publicUser },
    _count: { select: { likes: true, comments: true } },
    likes: { where: { userId }, select: { userId: true } },
    bookmarks: { where: { userId }, select: { userId: true } },
    comments: {
      orderBy: { createdAt: 'desc' },
      take: 2,
      include: { author: { select: publicUser } },
    },
  });
  const shapePost = (post) => ({
    ...post,
    liked: post.likes.length > 0,
    bookmarked: post.bookmarks.length > 0,
    likes: undefined,
    bookmarks: undefined,
    comments: post.comments.reverse(),
  });
  const requirePost = async (id) => {
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) throw fail(404, 'This post is no longer here.');
    return post;
  };
  app.get(
    '/api/posts',
    asyncRoute(async (req, res) => {
      const scope = z
        .enum(['following', 'discover', 'saved'])
        .default('following')
        .parse(req.query.scope);
      const q = z.string().max(100).default('').parse(req.query.q);
      const author = z.string().max(100).optional().parse(req.query.author);
      const cursor = z.string().max(100).optional().parse(req.query.cursor);
      let where = {};
      if (author) where.author = { username: author };
      else if (scope === 'following')
        where.OR = [
          { authorId: req.user.id },
          { author: { followers: { some: { followerId: req.user.id, status: 'ACCEPTED' } } } },
        ];
      else if (scope === 'saved') where.bookmarks = { some: { userId: req.user.id } };
      if (q) where.content = { contains: q, mode: 'insensitive' };
      const posts = await prisma.post.findMany({
        where,
        include: postInclude(req.user.id),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: pageSize + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const hasMore = posts.length > pageSize;
      if (hasMore) posts.pop();
      res.json({ posts: posts.map(shapePost), nextCursor: hasMore ? posts.at(-1).id : null });
    }),
  );
  app.post(
    '/api/posts',
    asyncRoute(async (req, res) => {
      const data = postInput.parse(req.body);
      if (data.imageUrl && !data.imageAlt)
        throw fail(400, 'Add a short image description for accessibility.');
      const post = await prisma.post.create({
        data: { ...data, authorId: req.user.id },
        include: postInclude(req.user.id),
      });
      res.status(201).json(shapePost(post));
    }),
  );
  app.delete(
    '/api/posts/:id',
    asyncRoute(async (req, res) => {
      const post = await requirePost(req.params.id);
      if (post.authorId !== req.user.id) throw fail(403, 'You can only delete your own posts.');
      await prisma.post.delete({ where: { id: post.id } });
      res.status(204).end();
    }),
  );
  for (const [route, model] of [
    ['like', 'like'],
    ['bookmark', 'bookmark'],
  ]) {
    app.put(
      `/api/posts/:id/${route}`,
      asyncRoute(async (req, res) => {
        await requirePost(req.params.id);
        const key = { userId: req.user.id, postId: req.params.id };
        await prisma[model].createMany({ data: [key], skipDuplicates: true });
        res.status(204).end();
      }),
    );
    app.delete(
      `/api/posts/:id/${route}`,
      asyncRoute(async (req, res) => {
        await requirePost(req.params.id);
        await prisma[model].deleteMany({ where: { userId: req.user.id, postId: req.params.id } });
        res.status(204).end();
      }),
    );
  }
  app.get(
    '/api/posts/:id/comments',
    asyncRoute(async (req, res) => {
      await requirePost(req.params.id);
      const cursor = z.string().max(100).optional().parse(req.query.cursor);
      const comments = await prisma.comment.findMany({
        where: { postId: req.params.id },
        include: { author: { select: publicUser } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 31,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const more = comments.length > 30;
      if (more) comments.pop();
      res.json({ comments, nextCursor: more ? comments.at(-1).id : null });
    }),
  );
  app.post(
    '/api/posts/:id/comments',
    asyncRoute(async (req, res) => {
      await requirePost(req.params.id);
      const { content } = z.object({ content: text(500) }).parse(req.body);
      const comment = await prisma.comment.create({
        data: { content, postId: req.params.id, authorId: req.user.id },
        include: { author: { select: publicUser } },
      });
      res.status(201).json(comment);
    }),
  );
  app.delete(
    '/api/comments/:id',
    asyncRoute(async (req, res) => {
      const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
      if (!comment) throw fail(404, 'This comment is no longer here.');
      if (comment.authorId !== req.user.id)
        throw fail(403, 'You can only delete your own comments.');
      await prisma.comment.delete({ where: { id: comment.id } });
      res.status(204).end();
    }),
  );
  const userInclude = (id) => ({
    ...publicUser,
    _count: {
      select: {
        posts: true,
        followers: { where: { status: 'ACCEPTED' } },
        following: { where: { status: 'ACCEPTED' } },
      },
    },
    followers: { where: { followerId: id }, select: { status: true } },
  });
  const shapeUser = (user) => ({
    ...user,
    relationship: user.followers[0]?.status || null,
    followers: undefined,
  });
  app.get(
    '/api/users',
    asyncRoute(async (req, res) => {
      const q = z.string().max(100).default('').parse(req.query.q);
      const cursor = z.string().max(100).optional().parse(req.query.cursor);
      const users = await prisma.user.findMany({
        where: {
          isGuest: false,
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { username: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        select: userInclude(req.user.id),
        orderBy: { id: 'asc' },
        take: 25,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const more = users.length > 24;
      if (more) users.pop();
      res.json({ users: users.map(shapeUser), nextCursor: more ? users.at(-1).id : null });
    }),
  );
  app.get(
    '/api/users/:username',
    asyncRoute(async (req, res) => {
      const user = await prisma.user.findUnique({
        where: { username: req.params.username },
        select: userInclude(req.user.id),
      });
      if (!user) throw fail(404, 'We could not find that profile.');
      res.json(shapeUser(user));
    }),
  );
  app.patch(
    '/api/profile',
    asyncRoute(async (req, res) => {
      const data = profileInput.parse(req.body);
      const user = await prisma.user.update({
        where: { id: req.user.id },
        data,
        select: publicUser,
      });
      res.json(user);
    }),
  );
  app.post(
    '/api/users/:id/follow',
    asyncRoute(async (req, res) => {
      if (req.params.id === req.user.id) throw fail(400, 'You cannot follow yourself.');
      const target = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!target) throw fail(404, 'That member is unavailable.');
      const key = { followerId: req.user.id, followingId: target.id };
      await prisma.follow.createMany({ data: [key], skipDuplicates: true });
      const follow = await prisma.follow.findUnique({ where: { followerId_followingId: key } });
      res.status(201).json({ status: follow.status });
    }),
  );
  app.delete(
    '/api/users/:id/follow',
    asyncRoute(async (req, res) => {
      await prisma.follow.deleteMany({
        where: { followerId: req.user.id, followingId: req.params.id },
      });
      res.status(204).end();
    }),
  );
  app.get(
    '/api/requests',
    asyncRoute(async (req, res) => {
      const requests = await prisma.follow.findMany({
        where: { followingId: req.user.id, status: 'PENDING' },
        include: { follower: { select: publicUser } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      res.json({ requests });
    }),
  );
  app.put(
    '/api/requests/:id',
    asyncRoute(async (req, res) => {
      const { action } = z.object({ action: z.enum(['accept', 'decline']) }).parse(req.body);
      const where = { followerId: req.params.id, followingId: req.user.id, status: 'PENDING' };
      const result =
        action === 'accept'
          ? await prisma.follow.updateMany({ where, data: { status: 'ACCEPTED' } })
          : await prisma.follow.deleteMany({ where });
      if (!result.count) throw fail(404, 'This request is no longer pending.');
      res.status(204).end();
    }),
  );
  app.get(
    '/api/stats',
    asyncRoute(async (req, res) => {
      const [members, posts, requests] = await Promise.all([
        prisma.user.count({ where: { isGuest: false } }),
        prisma.post.count(),
        prisma.follow.count({ where: { followingId: req.user.id, status: 'PENDING' } }),
      ]);
      res.json({ members, posts, requests });
    }),
  );
  app.use('/api', (_req, _res, next) => next(fail(404, 'That endpoint does not exist.')));
  app.use(express.static(path.resolve('public'), { maxAge: production ? '1h' : 0 }));
  app.get('/{*path}', (_req, res) => res.sendFile(path.resolve('public/index.html')));
  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError)
      return res.status(400).json({ error: error.issues[0].message });
    if (error.code === 'P2002')
      return res.status(409).json({ error: 'That email or username is already in use.' });
    if (error.code === 'P2025')
      return res.status(404).json({ error: 'This item is no longer here.' });
    if (error.type === 'entity.parse.failed')
      return res.status(400).json({ error: 'The request must contain valid JSON.' });
    if (error.type === 'entity.too.large')
      return res.status(413).json({ error: 'This request is too large.' });
    if (!error.status) console.error(error);
    res
      .status(error.status || 500)
      .json({ error: error.status ? error.message : 'Something went wrong. Please try again.' });
  });
  return app;
}
