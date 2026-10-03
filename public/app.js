import { DEMO } from './config.js';
import { icon } from './icons.js';
import { members } from './sample-data.js';

const root = document.querySelector('#app');
const modal = document.querySelector('#modal');
const state = {
  user: null,
  csrf: '',
  allowGuest: true,
  posts: new Map(),
  comments: new Map(),
  stats: {},
  people: [],
  draft: '',
  nextCursor: null,
  loading: false,
  revision: 0,
};
const esc = (value = '') =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const asset = (value) => (value.startsWith('/assets/') ? `.${value}` : value);
const safeUrl = (value) => {
  if (value?.startsWith('/assets/')) return asset(value);
  try {
    return new URL(value).protocol === 'https:' ? value : '';
  } catch {
    return '';
  }
};
const avatar = (user, cls = '') => {
  const url = safeUrl(user.avatarUrl);
  const initials = user.name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('');
  const color = /^#[a-f0-9]{6}$/i.test(user.color || '') ? user.color : '#dce8dc';
  return `<span class="avatar ${cls}" style="background:${color}" aria-hidden="true">${url ? `<img src="${esc(url)}" alt="" loading="lazy" data-fallback="${esc(initials)}">` : esc(initials)}</span>`;
};
function handle(user) {
  return user.isGuest ? 'guest explorer' : `@${user.username}`;
}
function profileLink(user) {
  return `#profile/${encodeURIComponent(user.username)}`;
}
function time(date) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function toast(message, error = false) {
  const node = document.querySelector('#toast');
  node.textContent = message;
  node.className = `toast visible${error ? ' error' : ''}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('visible'), 4000);
}
let demo;
if (DEMO) {
  const { createDemo } = await import('./demo.js');
  demo = createDemo();
}
async function api(url, options = {}) {
  if (demo) return demo.request(url, options);
  const response = await fetch(`.${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.method && options.method !== 'GET' ? { 'X-CSRF-Token': state.csrf } : {}),
      ...options.headers,
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if (response.status === 401 && !url.startsWith('/api/auth/')) {
      state.user = null;
      renderAuth();
    }
    throw new Error(body?.error || 'Something went wrong. Please try again.');
  }
  return body;
}
function getRoute() {
  const raw = location.hash.slice(1) || 'home';
  const [path, query = ''] = raw.split('?');
  const [page, username] = path.split('/');
  return {
    page: ['home', 'discover', 'people', 'saved', 'requests', 'profile'].includes(page)
      ? page
      : 'home',
    username: username ? decodeURIComponent(username) : null,
    q: new URLSearchParams(query).get('q') || '',
  };
}
function empty(title, description, symbol = 'leaf', action = '') {
  return `<div class="empty"><span class="empty-icon">${icon(symbol)}</span><h2>${esc(title)}</h2><p>${esc(description)}</p>${action}</div>`;
}
function renderAuth(register = false) {
  state.revision++;
  document.title = `${register ? 'Join' : 'Sign in'} · Odinbook`;
  root.innerHTML = `${DEMO ? '<div class="demo-strip">Portfolio sandbox · Everything you do stays in this browser.</div>' : ''}
    <main id="main" class="auth-layout">
      <section class="auth-story" aria-label="Welcome to Odinbook">
        <a class="brand" href="#home"><span class="brand-icon">o</span>odinbook<span class="visually-hidden"> home</span></a>
        <div class="auth-story-content"><p class="eyebrow">GOOD PEOPLE. SMALL MOMENTS.</p><h1>A little more<br><em>connected.</em></h1><p>Share what you’re building. Find your people. Grow a little, together.</p>
          <div class="auth-proof"><div class="avatar-stack">${members
            .slice(0, 4)
            .map((user) => avatar(user))
            .join('')}</div><span>A space for curious minds<br>and everyday progress.</span></div>
        </div><div class="auth-plant" aria-hidden="true"></div><p class="auth-story-footer">LESS NOISE. MORE CONNECTION. &nbsp; © ${new Date().getFullYear()} ODINBOOK</p>
      </section>
      <section class="auth-form-side"><div class="auth-form-container">
        <a class="brand auth-mobile-logo" href="#home"><span class="brand-icon">o</span>odinbook</a>
        <p class="eyebrow">YOUR LITTLE CORNER OF THE INTERNET</p><h2>${register ? 'Find your people.' : 'Welcome back.'}</h2><p>${register ? 'A fresh start, and some good company.' : 'Good to see you. Let’s pick up where we left off.'}</p>
        <form id="auth-form" class="auth-form" data-register="${register}">
          ${register ? '<div><label class="form-label" for="name">Your name</label><input class="form-input" id="name" name="name" autocomplete="name" maxlength="60" required></div><div><label class="form-label" for="username">Username</label><input class="form-input" id="username" name="username" autocomplete="username" minlength="3" maxlength="24" pattern="[a-z0-9_]+" placeholder="your_corner" required><p class="form-hint">Lowercase letters, numbers, and underscores.</p></div>' : ''}
          <div><label class="form-label" for="email">Email address</label><input class="form-input" id="email" name="email" type="email" autocomplete="email" maxlength="254" placeholder="you@example.com" required></div>
          <div><label class="form-label" for="password">Password</label><input class="form-input" id="password" name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" minlength="${register ? 10 : 1}" maxlength="128" placeholder="${register ? 'At least 10 characters' : 'Your password'}" required></div>
          <p class="form-error" id="auth-error" role="alert"></p><button type="submit" class="btn primary">${register ? 'Create account' : 'Sign in'} ${icon('arrow')}</button>
        </form>
        ${state.allowGuest ? `<div class="auth-divider">OR TAKE A LOOK AROUND</div><button class="btn outline guest-button" data-action="guest">${icon('compass')} Explore as a guest</button><p class="guest-note">No account needed. Curiosity is enough.</p>` : ''}
        <p class="auth-toggle">${register ? 'Already part of the community?' : 'New around here?'} <button data-action="auth-toggle" data-register="${!register}">${register ? 'Sign in' : 'Create an account'}</button></p>
        <p class="auth-bottom">Made for meaningful moments. Built by <a href="https://github.com/MiguelRcol" target="_blank" rel="noopener noreferrer">Miguel Rua ↗</a></p>
      </div></section>
    </main>`;
}
async function signIn(kind, body) {
  const session = await api(`/api/auth/${kind}`, { method: 'POST', body });
  state.user = session.user;
  state.csrf = session.csrfToken;
  state.draft = '';
  state.comments.clear();
  state.posts.clear();
  location.hash = 'home';
  await renderShell();
  toast(kind === 'guest' ? 'Welcome in. Make yourself at home.' : 'Good to have you here.');
}
function navLink(route, label, symbol, active) {
  return `<a class="nav-link ${active ? 'active' : ''}" data-route="${route}" href="#${route}" ${active ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${label}</span>${route === 'requests' && state.stats.requests ? `<span class="badge">${state.stats.requests}</span>` : ''}</a>`;
}
async function renderShell() {
  root.innerHTML = `${DEMO ? '<div class="demo-strip">Portfolio sandbox · Data stays in this browser. <button data-action="about">About this demo</button><button data-action="reset-demo">Reset demo</button></div>' : ''}
    <div class="app-layout"><aside class="sidebar" aria-label="Primary navigation">
      <a class="brand" href="#home"><span class="brand-icon">o</span>odinbook</a>
      <div><nav class="nav" id="navigation"></nav><button class="btn primary side-compose" data-action="compose">${icon('plus')} Create a post</button></div>
      <div class="sidebar-note">${icon('leaf')}<h3>A little better, together.</h3><p>Share the small wins. Ask the questions. Be someone’s good company.</p></div>
      <div class="account"><a href="${profileLink(state.user)}" aria-label="Your profile">${avatar(state.user)}</a><div class="account-info"><strong>${esc(state.user.name)}</strong><span>${esc(handle(state.user))}</span></div><button class="icon-button" data-action="logout" aria-label="Sign out">${icon('logout')}</button></div>
    </aside>
    <div class="workspace"><header class="topbar"><div class="topbar-title">Your everyday, a little closer<span class="topbar-subtitle">A space to share, connect, and keep growing.</span></div><a class="brand mobile-brand" href="#home"><span class="brand-icon">o</span>odinbook</a>
      <div class="topbar-actions"><form class="search" id="search-form" role="search">${icon('search')}<label for="global-search" class="visually-hidden">Search posts or people</label><input id="global-search" name="q" maxlength="100" placeholder="Search Odinbook"><button class="visually-hidden" type="submit">Search</button></form><a class="icon-button notification" id="notification-link" href="#requests" aria-label="Follow requests">${icon('bell')}</a><a href="${profileLink(state.user)}" class="avatar-link" aria-label="Your profile">${avatar(state.user, 'small-avatar')}</a></div>
    </header><div class="content-layout"><main id="main"></main><aside class="rightbar" id="rightbar" aria-label="Community highlights"></aside></div></div></div>`;
  await renderPage();
  refreshCommunity();
}
function updateNavigation() {
  const route = getRoute();
  document.querySelector('#navigation').innerHTML = [
    navLink('home', 'Home', 'home', route.page === 'home'),
    navLink('discover', 'Explore', 'compass', route.page === 'discover'),
    navLink('people', 'People', 'users', route.page === 'people'),
    navLink('requests', 'Requests', 'bell', route.page === 'requests'),
    navLink('saved', 'Bookmarks', 'bookmark', route.page === 'saved'),
    navLink(
      `profile/${state.user.username}`,
      'My profile',
      'user',
      route.page === 'profile' && route.username === state.user.username,
    ),
  ].join('');
  document
    .querySelector('#notification-link')
    .classList.toggle('has-notification', Boolean(state.stats.requests));
}
async function refreshCommunity() {
  try {
    const [stats, { users }] = await Promise.all([api('/api/stats'), api('/api/users')]);
    if (!state.user || !document.querySelector('#rightbar')) return;
    state.stats = stats;
    state.people = users;
    updateNavigation();
    const suggestions = users
      .filter((user) => user.id !== state.user.id && user.relationship !== 'ACCEPTED')
      .slice(0, 3);
    const people = suggestions.length
      ? suggestions
      : users.filter((user) => user.id !== state.user.id).slice(0, 3);
    document.querySelector('#rightbar').innerHTML = `
      <section class="card side-card"><div class="side-heading"><h2>Good people to know</h2><a href="#people">See all ${icon('arrow')}</a></div>${people.map((user) => `<div class="person"><a href="${profileLink(user)}" aria-label="${esc(user.name)}’s profile">${avatar(user)}</a><a class="person-info" href="${profileLink(user)}"><strong>${esc(user.name)}</strong><span>@${esc(user.username)}</span></a>${followButton(user, true)}</div>`).join('')}</section>
      <section class="card side-card"><div class="side-heading"><h2>Around the community</h2>${icon('leaf')}</div><a class="conversation-link" href="#discover?q=LearningInPublic"><strong>#LearningInPublic</strong><span>Progress, one day at a time</span></a><a class="conversation-link" href="#discover?q=BuildInPublic"><strong>#BuildInPublic</strong><span>The good, the bugs, the breakthroughs</span></a><a class="conversation-link" href="#discover?q=design"><strong>A little design inspiration</strong><span>Ideas worth making space for</span></a></section>
      <section class="community-card"><p class="eyebrow">YOU’RE IN GOOD COMPANY</p><h2>Big ideas.<br>Small beginnings.</h2><p>Every project starts somewhere.<br>This is a good place to share yours.</p><div class="avatar-stack">${users
        .slice(0, 5)
        .map((user) => avatar(user))
        .join(
          '',
        )}</div><span class="community-stat"><b>${stats.members}</b> curious minds, and counting</span></section>
      <footer class="footer"><a href="https://github.com/MiguelRcol/odinbook" target="_blank" rel="noopener noreferrer">Source code ↗</a><button data-action="about">About Odinbook</button><p>Made with care. &nbsp; © ${new Date().getFullYear()} Odinbook</p></footer>`;
  } catch (error) {
    console.warn('Community highlights unavailable:', error.message);
  }
}
function followButton(user, compact = false) {
  if (user.id === state.user.id) return '';
  const label =
    user.relationship === 'ACCEPTED'
      ? 'Following'
      : user.relationship === 'PENDING'
        ? 'Requested'
        : 'Follow';
  return `<button class="${compact ? 'follow-compact' : `btn ${user.relationship ? 'outline' : 'secondary'}`}" data-action="follow" data-id="${esc(user.id)}" data-status="${esc(user.relationship || '')}" aria-label="${label} ${esc(user.name)}">${!compact && !user.relationship ? icon('plus') : ''}${label}</button>`;
}
function composer() {
  return `<form class="composer card" id="post-form"><div class="composer-row">${avatar(state.user)}<label for="post-content" class="visually-hidden">What would you like to share?</label><textarea id="post-content" name="content" maxlength="2000" required placeholder="What’s on your mind, ${esc(state.user.name.split(' ')[0])}?">${esc(state.draft)}</textarea></div><div class="image-fields" id="image-fields" hidden><div><label class="form-label" for="image-url">Image URL</label><input class="form-input" id="image-url" name="imageUrl" type="url" maxlength="2000" placeholder="https://…"><p class="form-hint">Use an image you have permission to share.</p></div><div><label class="form-label" for="image-alt">Image description</label><input class="form-input" id="image-alt" name="imageAlt" maxlength="200" placeholder="Describe the image for people using screen readers"></div></div><div class="composer-bottom"><div class="composer-tools"><button type="button" class="tool-btn" data-action="attach-image" aria-expanded="false">${icon('image')} Add a photo</button><span class="char-count" id="char-count">${state.draft.length} / 2,000</span></div><button class="btn primary" type="submit">Post ${icon('arrow')}</button></div></form>`;
}
function commentMarkup(comment) {
  return `<div class="comment" data-comment-id="${esc(comment.id)}"><a href="${profileLink(comment.author)}" aria-label="${esc(comment.author.name)}’s profile">${avatar(comment.author, 'small-avatar')}</a><div class="bubble"><a href="${profileLink(comment.author)}"><strong>${esc(comment.author.name)}</strong></a><p>${esc(comment.content)}</p></div>${comment.author.id === state.user.id ? `<button class="icon-button comment-delete" data-action="delete-comment" data-id="${esc(comment.id)}" data-post-id="${esc(comment.postId)}" aria-label="Delete your comment">${icon('close')}</button>` : ''}</div>`;
}
function renderPost(post) {
  const expanded = state.comments.get(post.id);
  const comments = expanded ? expanded.items : post.comments;
  const image = safeUrl(post.imageUrl);
  return `<article class="post card" data-post-id="${esc(post.id)}" aria-label="Post by ${esc(post.author.name)}"><div class="post-header"><a href="${profileLink(post.author)}" aria-label="${esc(post.author.name)}’s profile">${avatar(post.author)}</a><div class="post-author"><a href="${profileLink(post.author)}"><strong>${esc(post.author.name)}</strong></a><span class="handle">${esc(handle(post.author))}</span><div class="post-meta"><time datetime="${esc(post.createdAt)}" title="${esc(new Date(post.createdAt).toLocaleString())}">${time(post.createdAt)}</time><span>·</span>${icon('globe')}<span>Community</span></div></div>${post.author.id === state.user.id ? `<button class="icon-button delete-post" data-action="delete-post" data-id="${esc(post.id)}" aria-label="Delete your post">${icon('trash')}</button>` : ''}</div>
    <p class="post-content">${esc(post.content)}</p>${image ? `<img class="post-image" src="${esc(image)}" alt="${esc(post.imageAlt)}" loading="lazy">` : ''}
    <div class="post-actions"><button class="post-action ${post.liked ? 'liked' : ''}" data-action="like" data-id="${esc(post.id)}" aria-pressed="${post.liked}" aria-label="${post.liked ? 'Unlike' : 'Like'} post">${icon('heart')}<span>${post._count.likes}</span></button><button class="post-action" data-action="comments" data-id="${esc(post.id)}" aria-expanded="${Boolean(expanded)}" aria-label="Read and add comments">${icon('comment')}<span>${post._count.comments} <span class="small">${post._count.comments === 1 ? 'comment' : 'comments'}</span></span></button><button class="post-action save ${post.bookmarked ? 'saved' : ''}" data-action="bookmark" data-id="${esc(post.id)}" aria-pressed="${post.bookmarked}" aria-label="${post.bookmarked ? 'Remove bookmark' : 'Bookmark post'}">${icon('bookmark')}</button></div>
    ${comments.length || expanded ? `<div class="comment-preview">${comments.map(commentMarkup).join('')}${expanded?.nextCursor || (!expanded && post._count.comments > comments.length) ? `<button class="comments-more" data-action="comments" data-id="${esc(post.id)}">${expanded ? 'Load more comments' : `View all ${post._count.comments} comments`}</button>` : ''}${expanded ? `<form class="comment-form" data-post-id="${esc(post.id)}"><label class="visually-hidden" for="comment-${esc(post.id)}">Your comment</label><input class="form-input" id="comment-${esc(post.id)}" name="content" maxlength="500" placeholder="Add to the conversation…" required><button class="btn secondary" type="submit" aria-label="Post comment">${icon('arrow')}</button></form>` : ''}</div>` : ''}
  </article>`;
}
function replacePost(id) {
  const node = document.querySelector(`[data-post-id="${CSS.escape(id)}"]`);
  if (node) node.outerHTML = renderPost(state.posts.get(id));
}
async function renderPage() {
  if (!state.user) return;
  const revision = ++state.revision;
  const route = getRoute();
  const main = document.querySelector('#main');
  if (!main) return;
  updateNavigation();
  state.posts.clear();
  state.comments.clear();
  state.nextCursor = null;
  main.innerHTML =
    '<div class="loading-card" role="status" aria-label="Loading content"></div><div class="loading-card" aria-hidden="true"></div>';
  const search = document.querySelector('#global-search');
  if (search) search.value = route.q;
  const titles = {
    home: 'Home',
    discover: 'Explore',
    people: 'People',
    requests: 'Follow requests',
    saved: 'Bookmarks',
    profile: 'Profile',
  };
  document.title = `${titles[route.page]} · Odinbook`;
  try {
    if (route.page === 'people') {
      const result = await api(`/api/users?${new URLSearchParams({ q: route.q })}`);
      if (revision !== state.revision) return;
      state.nextCursor = result.nextCursor;
      main.innerHTML = `<div class="page-heading"><p class="eyebrow">FIND YOUR PEOPLE</p><h1>Good company starts here.</h1><p>${route.q ? `People matching “${esc(route.q)}”` : 'Designers, developers, and curious minds. Say hello.'}</p></div><div class="people-grid" id="people-grid">${result.users.map(personCard).join('')}</div>${result.users.length ? loadMoreButton() : empty('No matches yet.', 'Try a different name or username.', 'search')}`;
      return;
    }
    if (route.page === 'requests') {
      const { requests } = await api('/api/requests');
      if (revision !== state.revision) return;
      main.innerHTML = `<div class="page-heading"><p class="eyebrow">MAKE A CONNECTION</p><h1>Your follow requests.</h1><p>You decide who becomes part of your everyday.</p></div><div class="requests-list">${requests.map((request) => `<div class="card request-card">${avatar(request.follower)}<a class="person-info" href="${profileLink(request.follower)}"><strong>${esc(request.follower.name)}</strong><span>@${esc(request.follower.username)} wants to follow you</span></a><div class="request-actions"><button class="btn secondary" data-action="accept" data-id="${esc(request.followerId)}">${icon('check')} Accept</button><button class="btn outline" data-action="decline" data-id="${esc(request.followerId)}">Decline</button></div></div>`).join('')}</div>${requests.length ? '' : empty('All caught up.', 'When someone wants to follow you, their request will appear here.', 'bell', '<a class="btn secondary" href="#people">Meet the community</a>')}`;
      return;
    }
    const parameters = {
      scope:
        route.page === 'discover' ? 'discover' : route.page === 'saved' ? 'saved' : 'following',
      q: route.q,
    };
    let heading = '';
    if (route.page === 'profile') {
      const profile = await api(
        `/api/users/${encodeURIComponent(route.username || state.user.username)}`,
      );
      parameters.author = profile.username;
      heading = renderProfile(profile);
    } else if (route.page === 'home')
      heading = `<section class="welcome"><p class="eyebrow">YOUR SPACE TO CONNECT</p><h1>A little more connected.</h1><p>Good conversations, small wins, and the people who get it.<br>Make yourself at home.</p><div class="welcome-art" aria-hidden="true"></div></section>${composer()}`;
    else if (route.page === 'discover')
      heading = `<div class="page-heading"><p class="eyebrow">A LITTLE OUTSIDE YOUR CIRCLE</p><h1>Something worth discovering.</h1><p>${route.q ? `Conversations matching “${esc(route.q)}”` : 'Fresh perspectives from across the community.'}</p></div>`;
    else
      heading = `<div class="page-heading"><p class="eyebrow">KEEP THE GOOD STUFF CLOSE</p><h1>Your bookmarks.</h1><p>A little collection of things you want to come back to.</p></div>`;
    const result = await api(`/api/posts?${new URLSearchParams(parameters)}`);
    if (revision !== state.revision) return;
    result.posts.forEach((post) => state.posts.set(post.id, post));
    state.nextCursor = result.nextCursor;
    const tabs = ['home', 'discover'].includes(route.page)
      ? `<div class="feed-tabs"><button data-action="navigate" data-page="home" class="${route.page === 'home' ? 'active' : ''}">Following</button><button data-action="navigate" data-page="discover" class="${route.page === 'discover' ? 'active' : ''}">For you</button><span class="feed-sort">Latest first ↓</span></div>`
      : '<div class="feed-tabs"><button class="active" type="button">Posts</button><span class="feed-sort">Latest first ↓</span></div>';
    main.innerHTML = `${heading}${tabs}<div class="posts" id="posts">${result.posts.map(renderPost).join('')}</div>${result.posts.length ? loadMoreButton() : empty(route.page === 'saved' ? 'Keep something good.' : 'The conversation starts with you.', route.page === 'saved' ? 'Bookmark a post and you’ll find it here.' : route.q ? 'No posts match your search. Try a different phrase.' : 'Share a thought, or follow a few people to fill your feed.', route.page === 'saved' ? 'bookmark' : 'comment', '<a class="btn secondary" href="#discover">Explore the community</a>')}`;
  } catch (error) {
    if (revision === state.revision && state.user)
      main.innerHTML = empty(
        'A small bump in the road.',
        error.message,
        'compass',
        '<button class="btn secondary" data-action="retry">Try again</button>',
      );
  }
}
function loadMoreButton() {
  return state.nextCursor
    ? '<button class="btn outline load-more" data-action="load-more">Load a little more</button>'
    : '';
}
function personCard(user) {
  return `<article class="card person-card"><a href="${profileLink(user)}" aria-label="${esc(user.name)}’s profile">${avatar(user)}</a><a href="${profileLink(user)}"><h2>${esc(user.name)}</h2></a><span class="handle">@${esc(user.username)}</span><p>${esc(user.bio || 'A new voice in the community.')}</p>${user.id === state.user.id ? `<a class="btn outline" href="${profileLink(user)}">Your profile ${icon('arrow')}</a>` : followButton(user)}</article>`;
}
function renderProfile(user) {
  return `<section class="card profile-card"><div class="profile-cover" aria-hidden="true"></div><div class="profile-info"><div class="profile-top">${avatar(user, 'large-avatar')}${user.id === state.user.id ? '<div><button class="btn outline" data-action="edit-profile">Edit profile</button><button class="btn outline" data-action="logout" aria-label="Sign out of your profile">Sign out</button></div>' : followButton(user)}</div><h1>${esc(user.name)}</h1><span class="handle">${esc(handle(user))}</span><p class="profile-bio">${esc(user.bio || 'A new chapter, waiting to be written.')}</p><div class="profile-details">${user.location ? `<span>${icon('pin')}${esc(user.location)}</span>` : ''}${safeUrl(user.website) ? `<a href="${esc(safeUrl(user.website))}" target="_blank" rel="noopener noreferrer">${icon('link')}${esc(new URL(user.website).hostname)} ↗</a>` : ''}<span>${icon('leaf')}Joined ${new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span></div><div class="profile-counts"><span><b>${user._count.posts}</b> posts</span><span><b>${user._count.followers}</b> followers</span><span><b>${user._count.following}</b> following</span></div></div></section>`;
}
function openModal(title, content) {
  modal.innerHTML = `<div class="modal-header"><h2 id="modal-title">${esc(title)}</h2><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></div>${content}`;
  if (!modal.open) modal.showModal();
}
function editProfile() {
  const user = state.user;
  openModal(
    'Make it feel like you.',
    `<form id="profile-form" class="modal-form"><div><label class="form-label" for="profile-name">Name</label><input class="form-input" id="profile-name" name="name" value="${esc(user.name)}" required maxlength="60"></div><div><label class="form-label" for="profile-bio">A little about you</label><textarea class="form-input" id="profile-bio" name="bio" maxlength="280">${esc(user.bio)}</textarea></div><div><label class="form-label" for="profile-location">Location</label><input class="form-input" id="profile-location" name="location" value="${esc(user.location)}" maxlength="80"></div><div><label class="form-label" for="profile-website">Website</label><input class="form-input" id="profile-website" name="website" type="url" value="${esc(user.website)}" maxlength="2000" placeholder="https://…"></div><div><label class="form-label" for="profile-avatar">Profile photo URL</label><input class="form-input" id="profile-avatar" name="avatarUrl" type="url" value="${esc(user.avatarUrl?.startsWith('/assets/') ? '' : user.avatarUrl)}" maxlength="2000" placeholder="https://…"><p class="form-hint">Use an HTTPS image URL, or leave blank for your initials.</p></div><p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="btn outline" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Save changes</button></div></form>`,
  );
}
async function loadMore() {
  const route = getRoute();
  const params = new URLSearchParams({ cursor: state.nextCursor, q: route.q });
  if (route.page !== 'people') {
    params.set(
      'scope',
      route.page === 'saved' ? 'saved' : route.page === 'discover' ? 'discover' : 'following',
    );
    if (route.page === 'profile') params.set('author', route.username || state.user.username);
  }
  const revision = state.revision;
  const result = await api(`/api/${route.page === 'people' ? 'users' : 'posts'}?${params}`);
  if (revision !== state.revision) return;
  state.nextCursor = result.nextCursor;
  if (route.page === 'people')
    document
      .querySelector('#people-grid')
      .insertAdjacentHTML('beforeend', result.users.map(personCard).join(''));
  else {
    result.posts.forEach((post) => state.posts.set(post.id, post));
    document
      .querySelector('#posts')
      .insertAdjacentHTML('beforeend', result.posts.map(renderPost).join(''));
  }
  if (!result.nextCursor) document.querySelector('.load-more')?.remove();
}
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const { action, id } = button.dataset;
  if (action === 'auth-toggle') {
    renderAuth(button.dataset.register === 'true');
    return;
  }
  if (action === 'close-modal') {
    modal.close();
    return;
  }
  if (action === 'navigate') {
    location.hash = button.dataset.page;
    return;
  }
  if (action === 'retry') {
    await renderPage();
    return;
  }
  if (action === 'attach-image') {
    const fields = document.querySelector('#image-fields');
    fields.hidden = !fields.hidden;
    button.setAttribute('aria-expanded', String(!fields.hidden));
    document.querySelector('#image-alt').required = !fields.hidden;
    document.querySelector('#image-url').required = !fields.hidden;
    if (!fields.hidden) document.querySelector('#image-url').focus();
    return;
  }
  if (action === 'compose') {
    if (getRoute().page !== 'home') {
      location.hash = 'home';
      await renderPage();
    }
    document.querySelector('#post-content')?.focus();
    document.querySelector('#post-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (action === 'edit-profile') {
    editProfile();
    return;
  }
  if (action === 'about') {
    openModal(
      'A little more about Odinbook.',
      `<p class="muted">Odinbook is a full-stack social app by Miguel Rua, built for The Odin Project. It brings profiles, follow requests, posts, likes, comments, and bookmarks together in a calmer corner of the internet.</p><p class="form-hint" style="margin-top:18px">${DEMO ? 'You are using a browser-only portfolio sandbox. Changes are stored locally, accounts are simulated, and no shared server or database is connected. The repository contains the real Express + Passport + Prisma + PostgreSQL implementation.' : 'This app uses Passport authentication, secure cookie sessions, and PostgreSQL persistence. Each guest gets a separate profile. Guest profiles may be cleaned up after seven days.'}</p><div class="modal-actions"><a class="btn secondary" href="https://github.com/MiguelRcol/odinbook" target="_blank" rel="noopener noreferrer">View source ${icon('arrow')}</a></div>`,
    );
    return;
  }
  if (action === 'delete-post' || action === 'delete-comment') {
    openModal(
      'Remove this contribution?',
      `<p class="muted">Your ${action === 'delete-post' ? 'post and its comments' : 'comment'} will be permanently removed.</p><div class="modal-actions"><button class="btn outline" data-action="close-modal">Keep it</button><button class="btn primary" data-action="confirm-delete" data-kind="${action}" data-id="${esc(id)}" data-post-id="${esc(button.dataset.postId || '')}">Remove it</button></div>`,
    );
    return;
  }
  button.disabled = true;
  try {
    if (action === 'guest') await signIn('guest');
    if (action === 'logout') {
      await api('/api/auth/logout', { method: 'POST' });
      state.user = null;
      state.draft = '';
      state.posts.clear();
      const session = await api('/api/session');
      state.csrf = session.csrfToken;
      renderAuth();
    }
    if (action === 'like' || action === 'bookmark') {
      const post = state.posts.get(id);
      const key = action === 'like' ? 'liked' : 'bookmarked';
      await api(`/api/posts/${encodeURIComponent(id)}/${action}`, {
        method: post[key] ? 'DELETE' : 'PUT',
      });
      post[key] = !post[key];
      if (action === 'like') post._count.likes += post.liked ? 1 : -1;
      replacePost(id);
      if (action === 'bookmark')
        toast(post.bookmarked ? 'Saved for a little later.' : 'Bookmark removed.');
    }
    if (action === 'comments') {
      const previous = state.comments.get(id);
      if (previous && !previous.nextCursor) {
        state.comments.delete(id);
        replacePost(id);
        return;
      }
      const result = await api(
        `/api/posts/${encodeURIComponent(id)}/comments${previous?.nextCursor ? `?cursor=${encodeURIComponent(previous.nextCursor)}` : ''}`,
      );
      state.comments.set(id, {
        items: [...(previous?.items || []), ...result.comments],
        nextCursor: result.nextCursor,
      });
      replacePost(id);
      if (!previous) document.querySelector(`#comment-${CSS.escape(id)}`)?.focus();
    }
    if (action === 'follow') {
      const wasFollowing = Boolean(button.dataset.status);
      const result = await api(`/api/users/${encodeURIComponent(id)}/follow`, {
        method: wasFollowing ? 'DELETE' : 'POST',
      });
      document
        .querySelectorAll(`[data-action="follow"][data-id="${CSS.escape(id)}"]`)
        .forEach((node) => {
          node.dataset.status = wasFollowing ? '' : result.status;
          node.textContent = wasFollowing
            ? 'Follow'
            : result.status === 'ACCEPTED'
              ? 'Following'
              : 'Requested';
        });
      toast(wasFollowing ? 'Connection removed.' : 'Follow request sent.');
      if (getRoute().page === 'profile') await renderPage();
      refreshCommunity();
    }
    if (action === 'accept' || action === 'decline') {
      await api(`/api/requests/${encodeURIComponent(id)}`, { method: 'PUT', body: { action } });
      toast(action === 'accept' ? 'A new connection. Nice.' : 'Request declined.');
      await renderPage();
      refreshCommunity();
    }
    if (action === 'load-more') await loadMore();
    if (action === 'confirm-delete') {
      const postId = button.dataset.postId;
      const isPost = button.dataset.kind === 'delete-post';
      await api(`/api/${isPost ? 'posts' : 'comments'}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      modal.close();
      toast(isPost ? 'Post removed.' : 'Comment removed.');
      if (isPost) {
        await renderPage();
        refreshCommunity();
      } else {
        const post = state.posts.get(postId);
        post._count.comments--;
        post.comments = post.comments.filter((comment) => comment.id !== id);
        const expanded = state.comments.get(postId);
        if (expanded) expanded.items = expanded.items.filter((comment) => comment.id !== id);
        replacePost(postId);
      }
    }
    if (action === 'reset-demo') {
      demo.reset();
      state.user = null;
      location.hash = 'home';
      renderAuth();
      toast('A fresh start. The demo has been reset.');
    }
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
  }
});
document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (
    !['auth-form', 'post-form', 'profile-form', 'search-form'].includes(form.id) &&
    !form.classList.contains('comment-form')
  )
    return;
  event.preventDefault();
  const button = form.querySelector('[type="submit"]');
  if (button.disabled) return;
  const body = Object.fromEntries(new FormData(form));
  if (form.id === 'search-form') {
    location.hash = `${getRoute().page === 'people' ? 'people' : 'discover'}?${new URLSearchParams({ q: body.q.trim() })}`;
    return;
  }
  button.disabled = true;
  const errorNode = form.querySelector('.form-error');
  if (errorNode) errorNode.textContent = '';
  try {
    if (form.id === 'auth-form')
      await signIn(form.dataset.register === 'true' ? 'register' : 'login', body);
    if (form.id === 'post-form') {
      if (document.querySelector('#image-fields').hidden) {
        body.imageUrl = '';
        body.imageAlt = '';
      }
      await api('/api/posts', { method: 'POST', body });
      state.draft = '';
      await renderPage();
      refreshCommunity();
      toast('Your thought is out in the world.');
    }
    if (form.classList.contains('comment-form')) {
      const id = form.dataset.postId;
      const comment = await api(`/api/posts/${encodeURIComponent(id)}/comments`, {
        method: 'POST',
        body,
      });
      const post = state.posts.get(id);
      post._count.comments++;
      state.comments.get(id).items.push(comment);
      replacePost(id);
      toast('Added to the conversation.');
    }
    if (form.id === 'profile-form') {
      state.user = await api('/api/profile', { method: 'PATCH', body });
      modal.close();
      await renderShell();
      toast('Looking more like you.');
    }
  } catch (error) {
    if (errorNode) errorNode.textContent = error.message;
    else toast(error.message, true);
  } finally {
    button.disabled = false;
  }
});
document.addEventListener('input', (event) => {
  if (event.target.id !== 'post-content') return;
  state.draft = event.target.value;
  document.querySelector('#char-count').textContent =
    `${state.draft.length.toLocaleString('en-US')} / 2,000`;
});
document.addEventListener(
  'error',
  (event) => {
    if (event.target.tagName === 'IMG' && event.target.dataset.fallback)
      event.target.replaceWith(document.createTextNode(event.target.dataset.fallback));
  },
  true,
);
modal.addEventListener('click', (event) => {
  if (event.target === modal) {
    const rect = modal.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      modal.close();
  }
});
window.addEventListener('hashchange', () => {
  if (state.user) {
    renderPage();
    window.scrollTo({ top: 0 });
  }
});
async function boot() {
  try {
    const session = await api('/api/session');
    state.user = session.user;
    state.csrf = session.csrfToken;
    state.allowGuest = session.allowGuest;
    if (state.user) await renderShell();
    else renderAuth();
  } catch (error) {
    root.innerHTML = `<main id="main" class="initial-loading">${empty('We couldn’t connect.', 'Check your connection and refresh to try again.', 'compass', '<button class="btn primary" id="reconnect">Reconnect</button>')}</main>`;
    document.querySelector('#reconnect').addEventListener('click', boot);
  }
}
await boot();
