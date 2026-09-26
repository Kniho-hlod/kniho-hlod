# Kniho-hlod

Your library, and who has borrowed what. A Czech book-lending app: your books, the people you lend
them to, due dates and reminders.

```
packages/domain   @kniho-hlod/domain — entities, DTOs and domain rules shared by both apps
apps/api          Express + Postgres REST API on @eleansphere/be-core
apps/web          Vue 3 + Nuxt UI single-page app, installable as a PWA
```

One entity definition per model in `packages/domain` yields the database table, the validated API
routes and the typed frontend service, so the API and the app can't drift apart. See
[`CLAUDE.md`](CLAUDE.md) for the architecture in detail.

## Getting started

Requires Node from [`.nvmrc`](.nvmrc), pnpm (`corepack enable`) and Docker.

```bash
docker compose up -d                 # Postgres on :5434, Mailpit on :8025
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm install
pnpm dev                             # API on :3000, web on :5173
```

Reading `@eleansphere/*` from GitHub Packages needs `NODE_AUTH_TOKEN` (a classic PAT with
`read:packages`) in your environment, plus this line in your user-level `~/.npmrc` — pnpm ignores
registry tokens in the project's `.npmrc`:

```
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

```bash
pnpm --filter @kniho-hlod/api seed:admin   # the first administrator, from ADMIN_* in apps/api/.env
```

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test       # unit tests, plus API integration tests against the Postgres container
pnpm test:e2e   # Playwright: auth, books, ISBN scanning, loans, shelves, administration
pnpm build
```

## Database migrations

The API applies pending migrations on startup (`apps/api/src/migrations/`). The first one,
`2026-09-26-baseline`, is the schema as it stood when the app switched from `sync()` to
migrations; it changes nothing on a database that already has it. A change to a model in
`packages/domain` needs a migration too — `migrations.integration.test.ts` compares the
migrated schema with the models and fails until they match.

## Scheduled jobs

```bash
pnpm --filter @kniho-hlod/api job loan-reminders   # locally; in production: node dist/jobs.cjs loan-reminders
```

`loan-reminders` e-mails every reader who wants reminders about the books they lent that are due
soon or overdue, once a day at most. It uses the API's image and variables and never migrates.

## Deployment

| Part | Where | Notes |
|---|---|---|
| API | Railway | [`railway.json`](railway.json) builds [`apps/api/Dockerfile`](apps/api/Dockerfile) from the repository root; every push to `main` that touches the API deploys |
| Reminders | Railway cron service | The API's Dockerfile, start command `node dist/jobs.cjs loan-reminders`, schedule `0 5 * * *` (UTC), the API's variables |
| Database | Railway Postgres | `DATABASE_URL` |
| Web | Vercel | [`apps/web/vercel.json`](apps/web/vercel.json); root directory `apps/web` |
| Files | Cloudflare R2 | the `R2_*` variables |
| Email | Resend | `RESEND_API_KEY`, `EMAIL_FROM` |

Both hosts need `NODE_AUTH_TOKEN` as a build variable, and it has to reach pnpm through the
user-level npm config, as above (CI gets that from `actions/setup-node`'s `registry-url`; the API
Dockerfile and the Vercel install copy [`tooling/user.npmrc`](tooling/user.npmrc)). The web's API
address comes from [`apps/web/.env.production`](apps/web/.env.production).

`railway.json` is Railway's "Config as Code", which Railway retires on 2026-12-01; the cron
service is configured in its settings instead.

## Environment variables

API ([`apps/api/.env.example`](apps/api/.env.example) has local defaults):

| Variable | |
|---|---|
| `NODE_ENV` | `production` in the Docker image: then email and R2 are required |
| `PORT` | Default `3000` |
| `DATABASE_URL`, `DATABASE_SSL` | Postgres; SSL unless `DATABASE_SSL=false` |
| `JWT_SECRET` | At least 32 characters |
| `APP_BASE_URL` | The web app: links in e-mails point here; the default CORS origin |
| `CORS_ORIGINS` | Comma-separated, when more origins than `APP_BASE_URL` call the API |
| `TRUST_PROXY` | `1` behind Railway's proxy, so rate limits see the client |
| `EMAIL_FROM` | Sender, e.g. `Kniho-hlod <noreply@kniho-hlod.klotilda.cz>` |
| `RESEND_API_KEY` | E-mail through Resend; otherwise `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`; with neither, e-mails are only logged |
| `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL` | Uploaded covers and avatars; without `R2_BUCKET` they are kept in memory |
| `GOOGLE_BOOKS_API_KEY` | Optional: the ISBN lookup's own Google Books quota |
| `ALLOW_MISSING_EMAIL_AND_STORAGE` | `true` lets production start without e-mail and R2 (first deploys only) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME` | Only for `seed:admin` |
| `NODE_AUTH_TOKEN` | Build only: reads `@eleansphere/*` from GitHub Packages |

Web: `VITE_API_URL`, the API's address ([`apps/web/.env.example`](apps/web/.env.example); production
in [`apps/web/.env.production`](apps/web/.env.production)), and `NODE_AUTH_TOKEN` for the build.
