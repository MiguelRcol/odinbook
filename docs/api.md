# API reference

Requests and responses are JSON, except successful delete/update operations that return `204 No Content`. Errors have the shape `{ "error": "Readable message" }`. Zod validation failures return 400; unauthenticated requests 401; CSRF/ownership failures 403; missing resources 404; account conflicts 409; rate limits 429.

## Session and identity

Call `GET /api/session` first. Retain its cookie and use the returned `csrfToken` in `X-CSRF-Token` for **every mutation**, including sign-in and registration. Successful login, registration, and guest entry return a rotated token; replace the previous value. API responses set `Cache-Control: no-store`.

| Method | Endpoint             | Input                             | Result                                        |
| ------ | -------------------- | --------------------------------- | --------------------------------------------- |
| GET    | `/api/session`       | —                                 | `{ user, csrfToken, allowGuest }`             |
| POST   | `/api/auth/register` | `name, username, email, password` | 201 `{ user, csrfToken }`                     |
| POST   | `/api/auth/login`    | `email, password`                 | `{ user, csrfToken }`                         |
| POST   | `/api/auth/guest`    | —                                 | 201 `{ user, csrfToken }`; new isolated guest |
| POST   | `/api/auth/logout`   | —                                 | 204; session destroyed                        |

Usernames contain 3–24 lowercase letters, numbers, or underscores. Passwords contain 10–128 characters on registration. Public profiles do not include email or password hashes. Auth endpoints are limited to 25 requests per 15 minutes per IP. Other protected API requests are limited to 120 per minute per IP.

## Posts and conversations

| Method       | Endpoint                  | Input                                                                         | Result                     |
| ------------ | ------------------------- | ----------------------------------------------------------------------------- | -------------------------- |
| GET          | `/api/posts`              | Query: `scope=following\|discover\|saved`, `author=<username>`, `q`, `cursor` | `{ posts, nextCursor }`    |
| POST         | `/api/posts`              | `content`, optional `imageUrl, imageAlt`                                      | 201 full post              |
| DELETE       | `/api/posts/:id`          | —                                                                             | 204; owner only            |
| PUT / DELETE | `/api/posts/:id/like`     | —                                                                             | 204; idempotent            |
| PUT / DELETE | `/api/posts/:id/bookmark` | —                                                                             | 204; idempotent, private   |
| GET          | `/api/posts/:id/comments` | Optional `cursor`                                                             | `{ comments, nextCursor }` |
| POST         | `/api/posts/:id/comments` | `content`                                                                     | 201 comment with author    |
| DELETE       | `/api/comments/:id`       | —                                                                             | 204; comment owner only    |

Posts contain 1–2,000 trimmed characters; comments 1–500. Images must use HTTPS and include a description of up to 200 characters. Every returned post has public `author`, `comments`, `_count.likes`, `_count.comments`, `liked`, and `bookmarked`. The initial post payload contains the two most recent comments, in chronological display order. The full comment endpoint contains at most 30 per page.

## Members and relationships

| Method | Endpoint                    | Input                                     | Result                                                                |
| ------ | --------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| GET    | `/api/users`                | Optional `q`, `cursor`                    | `{ users, nextCursor }`; up to 24 non-guest members                   |
| GET    | `/api/users/:username`      | —                                         | Profile, counts, `relationship`                                       |
| PATCH  | `/api/profile`              | `name, bio, location, website, avatarUrl` | Updated public profile; current user only                             |
| POST   | `/api/users/:id/follow`     | —                                         | 201 `{ status: "PENDING"\|"ACCEPTED" }`; repeated request keeps state |
| DELETE | `/api/users/:id/follow`     | —                                         | 204; unfollow or cancel request                                       |
| GET    | `/api/requests`             | —                                         | `{ requests }`; at most 50 incoming pending requests                  |
| PUT    | `/api/requests/:followerId` | `{ action: "accept"\|"decline" }`         | 204; recipient only                                                   |
| GET    | `/api/stats`                | —                                         | Member count, post count, own pending request count                   |
| GET    | `/health`                   | —                                         | Public database readiness check                                       |

Profile names have at most 60 characters, biographies 280, locations 80, and HTTPS URLs 2,000. `relationship` describes the current user's outgoing follow toward the returned profile. Counts include accepted followers/following only. Fields such as `id`, `email`, `username`, `passwordHash`, and `isGuest` cannot be modified through the profile endpoint.
