# Deployment

## Status and the two hosting modes

The GitHub Pages workflow deploys a **browser-only portfolio sandbox**. It uses the same interface but stores changes in the visitor's browser. It is useful for a résumé link and is explicitly labeled throughout the UI. It does not run Express, Passport sessions, or PostgreSQL.

The actual application is ready to deploy through `render.yaml` or the Dockerfile. Live backend deployment requires access to a hosting account; no Render connection was available during initial development. Check the repository's current deployments for any subsequent live backend URL.

## Render: full application

The checked-in [Blueprint](https://render.com/docs/blueprint-spec) creates a Node web service and PostgreSQL database, supplies the database connection string, generates a session secret, and sets the database-backed `/health` readiness endpoint.

1. Open [Deploy to Render](https://render.com/deploy?repo=https://github.com/MiguelRcol/odinbook).
2. Connect the repository and review the Blueprint's web service and database plans. Confirm current provider limits before creating resources.
3. Deploy. Build runs `npm ci --include=dev && npm run build`. Start applies migrations, seeds non-destructively, and launches Express.
4. Open the returned HTTPS URL and choose **Explore as a guest**.
5. Confirm the `/health` endpoint returns `{"status":"ok"}`. Create a real account, publish a post, and verify it survives a service restart.

Render supplies `PORT` and `RENDER_EXTERNAL_URL`. The app uses the latter for its origin check unless `APP_ORIGIN` is explicitly configured. When adding a custom domain, set `APP_ORIGIN` to the canonical HTTPS origin used by visitors. The service assumes one trusted reverse proxy and uses Secure session cookies in production. Do not set `LOCAL_POSTGRES` on a hosted instance.

Free plans are specified for portfolio evaluation; availability, sleep behavior, database expiration, backups, and retention are governed by the provider's current terms. Keep a durable database and backups if preserving user content matters. Free plans are not a promise of permanent hosting.

### Environment variables

| Variable              | Purpose                                                                       |
| --------------------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`        | PostgreSQL connection string; use the provider's documented TLS configuration |
| `SESSION_SECRET`      | At least 32 random characters; keep stable across restarts                    |
| `NODE_ENV=production` | Secure cookies, production asset caching, seeded-account sign-in disabled     |
| `PORT`                | Provider-selected listening port; defaults to 3020                            |
| `APP_ORIGIN`          | Optional canonical browser origin; defaults to Render's external URL          |
| `ALLOW_GUEST`         | `true` by default; set `false` to disable guest creation                      |

Do not commit secrets. `.env`, database files, test databases, and logs are ignored. Production seeding creates illustrative member profiles with disabled passwords. Existing seeded members are not overwritten by seeding; do not promote a local demonstration database containing shared-password accounts into production without disabling or changing those credentials first.

### Guest cleanup

Schedule `node scripts/cleanup-guests.js` daily using the same application environment and intended database. It removes guest profiles older than seven days and their posts, comments, likes, bookmarks, and follow relations through cascades. The provided Blueprint does not provision a paid scheduler. Until scheduled, guests remain stored; cleanup is available but not automatically enabled.

## Docker alternative

Requires Docker and Docker Compose. These files are provided for deployment portability; Docker was not available on the development machine, so the image has not been executed locally.

Set `SESSION_SECRET` to a random value in your environment or local `.env`, then:

```bash
docker compose up --build
```

Open http://localhost:3020. Compose uses development cookie behavior because the local endpoint is HTTP, while the Docker image defaults to production when deployed independently. A production deployment must provide HTTPS via a reverse proxy and `NODE_ENV=production`. The database uses a named volume; keep and back up that volume. The local Compose password is for local use only.

## GitHub Pages sandbox

Configure repository **Settings → Pages → Source → GitHub Actions**. The workflow copies `public/` into `dist/` and switches only the output's `config.js` to demo mode. The tracked real application's config remains `DEMO = false`.

For a local sandbox build:

```bash
npm run build:demo
npx http-server dist -p 8080
```

The sandbox supports guest entry, simulated local registration/sign-in, post interactions, profiles, and follow requests. Use two local demo accounts to demonstrate request acceptance. A guest starts with a sample incoming request from Daniel. Local account digests are only a convenience for the simulation, **not a production authentication design**. Never enter credentials you use elsewhere. Reset demo clears the sandbox's own storage key.

## References

- [Render's Express deployment guide](https://render.com/docs/deploy-node-express-app)
- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Passport login sessions](https://www.passportjs.org/concepts/authentication/sessions/)
- [Prisma PostgreSQL driver connections](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections)
