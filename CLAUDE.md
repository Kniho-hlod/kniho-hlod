# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Kniho-hlod** — a Czech book-lending app (kniha = book): a personal library, the people you lend
books to, due dates and email reminders. Rebuilt from scratch in 2026-09; the previous three-repo
version is archived in `projekty/_archiv/kniho-hlod-legacy/`.

pnpm workspace, three packages:

| Package | What it holds |
|---|---|
| `packages/domain` (`@kniho-hlod/domain`) | Entity definitions, DTO types, domain rules. Shared by both apps; ships TypeScript source, no build step. No Node or DOM APIs (enforced by ESLint). |
| `apps/api` (`@kniho-hlod/api`) | The REST API: `createCore` from `@eleansphere/be-core`, plus this project's configuration, file authorization, email templates and scripts. |
| `apps/web` (`@kniho-hlod/web`) | Vue 3 + Nuxt UI SPA, installable as a PWA. |

The shared foundation lives in [`Eleansphere/core`](https://github.com/Eleansphere/core):
`@eleansphere/schema` (field vocabulary + validation), `@eleansphere/be-core` (Express/Sequelize
framework) and `@eleansphere/entity-core` (client toolkit). Their READMEs are the reference for
`defineEntity`, access policies, list queries, auth and the file service.

## The one rule that shapes everything

An entity is declared **once**, in `packages/domain/src/entities/<name>/`:

- `fields.ts` — the columns and their rules (`as const satisfies Fields`)
- `index.ts` — `defineEntity({ name, prefix, access, query, indexes, fields, extend })`

From that single definition come the Postgres table, the validated CRUD routes with their access
rules, the DTO types, the typed frontend service and the form schema. Changing the data model means
changing `fields.ts` — never the API and the app separately.

- `entities/index.ts` exports `allEntities`; the API turns it into `modelConfigs` with
  `toModelConfigs(allEntities, { custom: ENTITIES_WITHOUT_CRUD_ROUTES })`.
- Forms validate with `formSchema(fields, mode)` (`apps/web/src/app/validation.ts`), which runs the
  *same* rules as the server and translates the issue codes.
- Cross-field rules (e.g. an announcement's date range) live in the domain package as pure
  functions, used by an API hook and by the form's `refine`.

## Backend

`apps/api/src/app-config.ts` is the whole backend, declared: models, route overrides, auth, email
and storage. `src/env.ts` reads and checks the environment; `src/index.ts` only starts it.

- Auth is be-core's: registration, login with rotating refresh tokens, `GET/PATCH/DELETE /api/auth/me`,
  password change and single-use reset links, rate limiting.
- Access: `user` is `admin`-only and currently has no CRUD routes; `systemNotification` is
  `admin`-only for writes, with a public `GET /api/system-notifications/active`.
- Files go through be-core's `/api/files`. `src/files/authorize-file-access.ts` decides who may
  upload what — today only your own avatar.
- Tests are integration tests (`*.integration.test.ts` / `app.integration.test.ts`) against the
  Postgres container, each in its own schema.

## Frontend

- `src/app/api.ts` — the `AuthSession` (tokens, automatic renewal after a 401) and the service
  container. Everything else imports `services` from here.
- `src/features/auth/session-store.ts` — Pinia store: who is signed in, and every action that
  changes it. Server state elsewhere goes through TanStack Query.
- Routing is in `src/app/router.ts`; `meta.requiresAuth` / `meta.guestOnly` / `meta.requiresRole`
  drive the guard. Layouts: `AppLayout` (signed in) and `GuestLayout` (sign-in and friends).
- UI is Nuxt UI v4 in plain-Vue mode; components auto-import. All texts go through vue-i18n
  (`src/locales/{cs,en}.json`) — including validation messages, keyed by issue code.
- Every `UForm` binds `:validate-on="VALIDATE_ON"` (`src/app/validation.ts`). Nuxt UI's default
  also validates on blur, so leaving an untouched field shows an error and shifts the layout under
  the pointer — the link or button being clicked moves away and the click is lost.
- E2E: Playwright reuses servers already running on :3000/:5173, and `DATABASE_URL` from the
  environment beats `apps/api/.env`. Make sure both point at the local containers before a run.

## Commands

```bash
docker compose up -d      # Postgres :5434, Mailpit :8025 (SMTP :1025)
pnpm dev                  # API :3000 + web :5173
pnpm lint / typecheck / test / build
pnpm test:e2e             # Playwright; needs the containers and both .env files
pnpm --filter @kniho-hlod/api seed:admin
```

## Conventions

- TypeScript everywhere, `verbatimModuleSyntax` (use `import type`), no `any`.
- Prettier: 100 columns, single quotes, semicolons. ESLint flat config at the root.
- Czech is the default language; keys live in both locale files.
- Don't commit unless asked — implement, verify, then stop.

## Status

Phase 1 (skeleton, auth, account, announcements) is in place. Books, loans, contacts, shelves,
ISBN lookup, reminders and the admin section arrive in the later phases; the plan lives in the
user's Obsidian vault (`moje_projekty/Kniho-hlod`).
