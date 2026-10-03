import { members, samplePosts } from './sample-data.js';

const storageKey = 'odinbook-portfolio-v1';
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
async function digest(value) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function fresh() {
  const users = members.map((member) => ({
    ...member,
    website: '',
    isGuest: false,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    email: `${member.username}@example.com`,
  }));
  const posts = samplePosts.map((post) => ({
    ...post,
    imageUrl: post.imageUrl || '',
    imageAlt: post.imageAlt || '',
    createdAt: new Date(Date.now() - post.minutes * 60000).toISOString(),
    likes: post.likes,
    likedBy: [],
    bookmarkedBy: [],
    comments: post.comments.map((comment) => ({
      ...comment,
      id: uid(),
      postId: post.id,
      createdAt: now(),
    })),
  }));
  return { users, posts, follows: [], currentId: null };
}
export function createDemo() {
  let data;
  try {
    data = JSON.parse(localStorage.getItem(storageKey)) || fresh();
    if (!Array.isArray(data.users) || !Array.isArray(data.posts) || !Array.isArray(data.follows))
      data = fresh();
  } catch {
    data = fresh();
  }
  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      throw new Error(
        'Your browser could not save this change. Free some storage or allow local storage and try again.',
      );
    }
  };
  const findUser = (id) => data.users.find((user) => user.id === id);
  const publicUser = (user) => {
    const { email, passwordDigest, ...profile } = user;
    return structuredClone(profile);
  };
  const userStats = (user, currentId) => ({
    ...publicUser(user),
    relationship:
      data.follows.find(
        (follow) => follow.followerId === currentId && follow.followingId === user.id,
      )?.status || null,
    _count: {
      posts: data.posts.filter((post) => post.authorId === user.id).length,
      followers: data.follows.filter(
        (follow) => follow.followingId === user.id && follow.status === 'ACCEPTED',
      ).length,
      following: data.follows.filter(
        (follow) => follow.followerId === user.id && follow.status === 'ACCEPTED',
      ).length,
    },
  });
  const shapeComment = (comment) => ({
    ...comment,
    author: publicUser(findUser(comment.authorId)),
  });
  const shapePost = (post, currentId) => ({
    ...post,
    author: publicUser(findUser(post.authorId)),
    comments: post.comments.slice(-2).map(shapeComment),
    liked: post.likedBy.includes(currentId),
    bookmarked: post.bookmarkedBy.includes(currentId),
    _count: { likes: post.likes + post.likedBy.length, comments: post.comments.length },
  });
  const getPost = (id) => {
    const post = data.posts.find((post) => post.id === id);
    if (!post) throw new Error('This post is no longer here.');
    return post;
  };
  function page(items, cursor, size) {
    const index = cursor ? items.findIndex((item) => item.id === cursor) + 1 : 0;
    const entries = items.slice(index, index + size);
    return { entries, nextCursor: index + size < items.length ? entries.at(-1).id : null };
  }
  return {
    reset() {
      data = fresh();
      save();
    },
    async request(url, options = {}) {
      const parsed = new URL(url, 'https://demo.odinbook.invalid');
      const path = parsed.pathname;
      const query = parsed.searchParams;
      const method = options.method || 'GET';
      const body = options.body || {};
      let user = findUser(data.currentId);
      if (path === '/api/session')
        return { user: user ? publicUser(user) : null, csrfToken: 'local-demo', allowGuest: true };
      if (path === '/api/auth/guest' && method === 'POST') {
        user = data.users.find((user) => user.id === 'guest');
        if (!user) {
          user = {
            id: 'guest',
            name: 'Alex Morgan',
            username: 'alex_explores',
            email: 'guest@demo.invalid',
            bio: 'Curious by default. Building something, learning something.',
            location: 'Somewhere on the internet',
            website: '',
            avatarUrl: '',
            color: '#dce8dc',
            createdAt: now(),
            isGuest: true,
          };
          data.users.push(user);
          data.follows.push(
            ...members.slice(0, 3).map((member) => ({
              followerId: user.id,
              followingId: member.id,
              status: 'ACCEPTED',
              createdAt: now(),
            })),
            { followerId: 'daniel', followingId: user.id, status: 'PENDING', createdAt: now() },
          );
        }
        data.currentId = user.id;
        save();
        return { user: publicUser(user), csrfToken: 'local-demo' };
      }
      if (path === '/api/auth/register' && method === 'POST') {
        if (data.users.some((user) => user.username === body.username || user.email === body.email))
          throw new Error('That email or username is already in use.');
        if (body.password.length < 10)
          throw new Error('Use at least 10 characters for your password.');
        user = {
          ...body,
          id: uid(),
          bio: '',
          location: '',
          website: '',
          avatarUrl: '',
          color: '#dce8dc',
          isGuest: false,
          createdAt: now(),
          passwordDigest: await digest(body.password),
        };
        delete user.password;
        data.users.push(user);
        data.currentId = user.id;
        save();
        return { user: publicUser(user), csrfToken: 'local-demo' };
      }
      if (path === '/api/auth/login' && method === 'POST') {
        user = data.users.find((user) => user.email === body.email && !user.isGuest);
        if (
          !user ||
          (user.passwordDigest
            ? user.passwordDigest !== (await digest(body.password))
            : body.password !== 'BuildSomething2026!')
        )
          throw new Error('Email or password is incorrect.');
        data.currentId = user.id;
        save();
        return { user: publicUser(user), csrfToken: 'local-demo' };
      }
      if (!user) throw new Error('Sign in to join the conversation.');
      if (path === '/api/auth/logout') {
        data.currentId = null;
        save();
        return null;
      }
      if (path === '/api/stats')
        return {
          members: data.users.filter((user) => !user.isGuest).length,
          posts: data.posts.length,
          requests: data.follows.filter(
            (follow) => follow.followingId === user.id && follow.status === 'PENDING',
          ).length,
        };
      if (path === '/api/posts' && method === 'GET') {
        let posts = [...data.posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        if (query.get('author'))
          posts = posts.filter((post) => findUser(post.authorId).username === query.get('author'));
        else if (query.get('scope') === 'saved')
          posts = posts.filter((post) => post.bookmarkedBy.includes(user.id));
        else if (query.get('scope') !== 'discover')
          posts = posts.filter(
            (post) =>
              post.authorId === user.id ||
              data.follows.some(
                (follow) =>
                  follow.followerId === user.id &&
                  follow.followingId === post.authorId &&
                  follow.status === 'ACCEPTED',
              ),
          );
        const q = (query.get('q') || '').toLowerCase();
        posts = posts.filter((post) => post.content.toLowerCase().includes(q));
        const result = page(posts, query.get('cursor'), 12);
        return {
          posts: result.entries.map((post) => shapePost(post, user.id)),
          nextCursor: result.nextCursor,
        };
      }
      if (path === '/api/posts' && method === 'POST') {
        if (!body.content?.trim() || body.content.length > 2000)
          throw new Error('Write between 1 and 2,000 characters.');
        if (body.imageUrl && !body.imageAlt) throw new Error('Add a short image description.');
        const post = {
          ...body,
          id: uid(),
          authorId: user.id,
          createdAt: now(),
          comments: [],
          likes: 0,
          likedBy: [],
          bookmarkedBy: [],
        };
        data.posts.push(post);
        save();
        return shapePost(post, user.id);
      }
      const postRoute = path.match(/^\/api\/posts\/([^/]+)(?:\/(like|bookmark|comments))?$/);
      if (postRoute) {
        const [, id, action] = postRoute;
        const post = getPost(decodeURIComponent(id));
        if (!action && method === 'DELETE') {
          if (post.authorId !== user.id) throw new Error('You can only delete your own posts.');
          data.posts = data.posts.filter((entry) => entry.id !== post.id);
          save();
          return null;
        }
        if (action === 'like' || action === 'bookmark') {
          const key = action === 'like' ? 'likedBy' : 'bookmarkedBy';
          post[key] = post[key].filter((id) => id !== user.id);
          if (method === 'PUT') post[key].push(user.id);
          save();
          return null;
        }
        if (action === 'comments') {
          if (method === 'GET') {
            const result = page(post.comments, query.get('cursor'), 30);
            return { comments: result.entries.map(shapeComment), nextCursor: result.nextCursor };
          }
          if (!body.content?.trim() || body.content.length > 500)
            throw new Error('Write between 1 and 500 characters.');
          const comment = {
            id: uid(),
            content: body.content.trim(),
            authorId: user.id,
            postId: post.id,
            createdAt: now(),
          };
          post.comments.push(comment);
          save();
          return shapeComment(comment);
        }
      }
      if (path.startsWith('/api/comments/') && method === 'DELETE') {
        const id = decodeURIComponent(path.split('/').at(-1));
        const post = data.posts.find((post) => post.comments.some((comment) => comment.id === id));
        const comment = post?.comments.find((comment) => comment.id === id);
        if (!comment) throw new Error('This comment is no longer here.');
        if (comment.authorId !== user.id) throw new Error('You can only delete your own comments.');
        post.comments = post.comments.filter((comment) => comment.id !== id);
        save();
        return null;
      }
      if (path === '/api/users') {
        const q = (query.get('q') || '').toLowerCase();
        const users = data.users.filter(
          (user) => !user.isGuest && `${user.name} ${user.username}`.toLowerCase().includes(q),
        );
        const result = page(users, query.get('cursor'), 24);
        return {
          users: result.entries.map((entry) => userStats(entry, user.id)),
          nextCursor: result.nextCursor,
        };
      }
      const followRoute = path.match(/^\/api\/users\/([^/]+)\/follow$/);
      if (followRoute) {
        const id = decodeURIComponent(followRoute[1]);
        if (!findUser(id) || id === user.id) throw new Error('That member is unavailable.');
        if (method === 'DELETE')
          data.follows = data.follows.filter(
            (follow) => !(follow.followerId === user.id && follow.followingId === id),
          );
        else if (
          !data.follows.some((follow) => follow.followerId === user.id && follow.followingId === id)
        )
          data.follows.push({
            followerId: user.id,
            followingId: id,
            status: 'PENDING',
            createdAt: now(),
          });
        save();
        return {
          status:
            data.follows.find(
              (follow) => follow.followerId === user.id && follow.followingId === id,
            )?.status || null,
        };
      }
      if (path.startsWith('/api/users/')) {
        const target = data.users.find(
          (user) => user.username === decodeURIComponent(path.split('/').at(-1)),
        );
        if (!target) throw new Error('We could not find that profile.');
        return userStats(target, user.id);
      }
      if (path === '/api/profile' && method === 'PATCH') {
        Object.assign(user, body);
        save();
        return publicUser(user);
      }
      if (path === '/api/requests')
        return {
          requests: data.follows
            .filter((follow) => follow.followingId === user.id && follow.status === 'PENDING')
            .map((follow) => ({ ...follow, follower: publicUser(findUser(follow.followerId)) })),
        };
      if (path.startsWith('/api/requests/')) {
        const id = decodeURIComponent(path.split('/').at(-1));
        const follow = data.follows.find(
          (follow) =>
            follow.followerId === id &&
            follow.followingId === user.id &&
            follow.status === 'PENDING',
        );
        if (!follow) throw new Error('This request is no longer pending.');
        if (body.action === 'accept') follow.status = 'ACCEPTED';
        else data.follows = data.follows.filter((entry) => entry !== follow);
        save();
        return null;
      }
      throw new Error('That endpoint does not exist in this sandbox.');
    },
  };
}
