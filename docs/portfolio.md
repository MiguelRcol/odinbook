# Odinbook project walkthrough

## The brief

Build a social network demonstrating Express, authentication, and relational data modeling. The core is users, profiles, posts, follow requests, likes, and comments. A recruiter's first visit should not require registration.

## The result

Odinbook takes a familiar social feed and gives it a calmer visual identity. Guest entry opens a useful, seeded community immediately. The main navigation distinguishes an accepted-follow feed from community discovery. Profiles, connections, and conversations stay tied to real PostgreSQL records in the full application.

The additional scope is deliberately adjacent to the core: HTTPS image posts, profile-picture updates, bookmarks, search, pagination, guest isolation, accessible interactions, and deployment tooling. Chat and real-time notification systems are deferred.

## Demonstration in five minutes

1. **First impression:** show the sign-in screen, enter as a guest, and explain that each guest gets an independent account rather than a shared writable identity.
2. **Social interaction:** post a small win, like another member's post, open comments, and contribute to the conversation. Show that every card includes its author and interaction counts.
3. **A personal collection:** bookmark a post and find it in Bookmarks.
4. **Relationships:** use two sessions with real member accounts. One sends a follow request; the other accepts. Show that posts enter the follower's home feed only after approval.
5. **Persistence:** edit a profile, refresh, and point to PostgreSQL persistence and the integration test suite.

If using the Pages sandbox, say so explicitly at the start. Its browser-only interactions demonstrate UX, while the source and local full-stack app demonstrate backend engineering.

## Engineering topics to explain

### Turning a brief into a social graph

A follow is a directed relation with pending and accepted states. A unique composite key prevents duplicate relationships. The recipient alone controls approval. That model directly drives the home-feed predicate and follower counts.

### Handling concurrency rather than hoping it won't happen

An early integration test sent multiple like requests simultaneously. A read-then-create upsert path could return a conflict. The final route uses a conflict-safe insert through `createMany` with `skipDuplicates`, backed by a composite primary key. The test asserts that every PUT succeeds and only one row exists.

### Protecting changes at several boundaries

Passport and stored sessions establish identity. CSRF validation protects mutations. Zod validates shape and lengths. Ownership checks authorize deletions and profile changes. Foreign keys, unique keys, and CHECK constraints preserve database integrity if an application path is wrong.

### Making the project easy to evaluate

An embedded PostgreSQL launcher makes the genuine database implementation runnable without Docker. Guest access removes signup friction. Curated posts make the feed meaningful, while Faker supplies reproducible additional profiles. A labeled static sandbox offers a low-friction portfolio link without claiming a backend that isn't there.

### Accessible polish

The interface uses semantic navigation and forms, screen-reader labels, image descriptions, native dialogs, keyboard focus, reduced motion, and responsive layouts. Automated axe checks complement functional browser tests; automated results do not replace testing with actual assistive technology.

## Requirements coverage

| Assignment requirement                        | Implementation                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| Authentication before community access        | Protected API; sign-in shell is the only unauthenticated UI                           |
| Chosen authentication method                  | Passport Local with scrypt password hashes                                            |
| Follow requests                               | Pending, accepted, canceled, and declined edges                                       |
| Text posts, likes, comments                   | API and interactive feed cards                                                        |
| Author, content, comments, likes on each post | Full post presentation plus inline comment previews                                   |
| Current user and followed-user feed           | Accepted-follow predicate, newest-first cursor pagination                             |
| Profiles and profile pictures                 | Editable public profiles with URL images or initial avatars                           |
| Profile information and posts                 | Dedicated profile route and author-filtered timeline                                  |
| User index with follow controls               | Searchable member grid and relationship-aware buttons                                 |
| Deployment                                    | Pages sandbox published separately; live Express/PostgreSQL requires a connected host |
| Optional images and avatar updates            | HTTPS image URL support and editable avatar URL                                       |
| Guest sign-in                                 | Isolated account per visit/session                                                    |
| Styling                                       | Responsive original visual identity, original SVG art                                 |

## Honest next steps

The live Express/PostgreSQL deployment is the remaining hosting dependency if no account is connected. For broader production use, prioritize password recovery and verification, reporting and moderation, owned media storage, operational backups, and shared rate limiting. Add realtime transport only when a specific interaction needs it.

## Résumé wording

> Built Odinbook, a full-stack social network with Express, Passport, Prisma, and PostgreSQL; implemented approved follow relationships, personalized feeds, posts, likes, comments, bookmarks, and isolated guest accounts, with integration tests and accessible responsive UI.

Once the backend is actually live, add its URL. Before that, label the Pages link as an interactive portfolio sandbox.
