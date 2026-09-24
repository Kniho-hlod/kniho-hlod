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
pnpm test:e2e   # Playwright: registration, sign-out, password reset through Mailpit
pnpm build
```

## Deployment

| Part | Where | Notes |
|---|---|---|
| API | Railway | [`railway.json`](railway.json) builds [`apps/api/Dockerfile`](apps/api/Dockerfile) from the repository root; every push to `main` that touches the API deploys |
| Database | Railway Postgres | `DATABASE_URL` |
| Web | Vercel | [`apps/web/vercel.json`](apps/web/vercel.json); root directory `apps/web` |
| Files | Cloudflare R2 | the `R2_*` variables |
| Email | Resend | `RESEND_API_KEY`, `EMAIL_FROM` |

Both hosts need `NODE_AUTH_TOKEN` as a build variable, and it has to reach pnpm through the
user-level npm config, as above (CI gets that from `actions/setup-node`'s `registry-url`, the
API image from its Dockerfile). In production the API refuses to start without Resend and R2;
`ALLOW_MISSING_EMAIL_AND_STORAGE=true` lets it run without them for now (reset emails only
logged, uploads kept in memory).
Environment variables are documented in
[`apps/api/.env.example`](apps/api/.env.example) and
[`apps/web/.env.example`](apps/web/.env.example).
