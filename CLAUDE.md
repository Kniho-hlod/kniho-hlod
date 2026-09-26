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
  `admin`-only for writes, with a public `GET /api/system-notifications/active`; `book`, `contact`,
  `loan` and `shelf` are `owner`-only (another reader's row answers 404).
- Books: the route hooks reject an invalid ISBN and reading dates out of order, and store the ISBN
  as ISBN-13. Every book the API returns carries `cover` (`src/books/book-covers.ts`), and a
  deleted book takes its cover with it.
- `GET /api/isbn/:isbn` (`src/isbn/`, one file per catalogue) asks Open Library
  (`/isbn/{isbn}.json`, author names from `/authors/…`), then Google Books: the details from the
  first that knows the ISBN, the cover from the first that has one. Answers are cached. A 404
  means "unknown", not an outage. Google's anonymous quota is shared and usually used up (429):
  set `GOOGLE_BOOKS_API_KEY` for a quota of our own. `…/cover` hands the cover over as base64
  JSON, which the app imports like an upload. Covers are only downloaded from the catalogues' own
  image hosts, and images under 3 kB are "no cover" placeholders. Tests pass a fake `fetch`.
- knihovny.cz, the Czech libraries' joint catalogue, answers our server (Railway) with 418 but
  lets any web page read its API, so the **app** asks it, from the reader's browser
  (`findInKnihovnyCz` in the domain package: search type `ISN`, records merged and stripped of
  cataloguing punctuation and life dates, the language from MARC field 008). Its covers can't be
  read by other pages, so they are never imported.
- Loans (`src/loans/`): a partial unique index allows one open loan per book (a race answers 409).
  Every book carries `activeLoan`, every contact `activeLoans`, every loan its `book` and
  `contact`. `?lent=true|false` on books is a custom list filter (`query.customFilters` in the
  entity, resolved in `routes.book.customFilters`). Loans reference book and contact with
  `RESTRICT`: deleting either refuses (409) while a loan is out and otherwise takes its returned
  loans along. `POST /api/loans/:id/return` returns a loan today in the reader's time zone.
- "Today" is `readerToday(timezone)` from the domain package — the API (return, stats) and the app
  (loan status, default dates) count the same day. `loanStatus(loan, today)` says `active`,
  `dueSoon` (within `DUE_SOON_DAYS`), `overdue` or `returned`.
- `GET /api/stats` (`src/stats/`) counts books, books being read, contacts and open loans by status.
- Shelves (`src/shelves/`): `bookShelf` pairs a book with a shelf (both `CASCADE`) and has no CRUD
  routes; `PUT /api/books/:id/shelves { shelfIds }` replaces a book's shelves in one transaction
  (a shelf that isn't the reader's is a `reference` issue). Every book carries `shelves` (in the
  reader's shelf order), every shelf `bookCount`; `?shelf=<id>` on books is a custom filter and
  `?isbn=` finds the reader's copy of a book. Shelf names are unique per reader, letter case aside.
- Cross-field rules check `{ ...stored, ...data }`: be-core hands `beforeUpdate` the stored row, so a
  PATCH of one date is still compared with the other.
- Files go through be-core's `/api/files`. `src/files/authorize-file-access.ts` decides who may
  upload what: your own avatar and covers of your own books.
- Callbacks that run per request but are declared before the models exist (`enrich`,
  `beforeDelete`, the file authorizer) get models from `src/models-registry.ts`.
- Tests are integration tests (`*.integration.test.ts` / `app.integration.test.ts`) against the
  Postgres container, each in its own schema.
- Deploy: Railway builds `apps/api/Dockerfile` (root `railway.json`) on every push to `main` that
  touches the API. `NODE_AUTH_TOKEN` arrives as a build arg; never name it in a `RUN` line —
  BuildKit prints RUN lines with args expanded, which once leaked the token into the build log.
  It reaches pnpm through the `${NODE_AUTH_TOKEN}` placeholder in `tooling/user.npmrc`, which
  the Vercel build (`apps/web/vercel.json`) copies the same way.

## Frontend

- `src/app/api.ts` — the `AuthSession` (tokens, automatic renewal after a 401) and the service
  container. Everything else imports `services` from here. Show uploaded files through
  `fileUrl(file)`: without a CDN the API answers with its own `/api/files/:id` path, which lives
  on the API's origin, not the app's.
- `main.ts` installs the router only after the stored session is restored — the router navigates
  the moment it is installed, and its guard must already know who is signed in.
- Books live in `src/features/books/` (vue-query composables in `api.ts`, form state in
  `book-form.ts`); covers are scaled to WebP in the browser (`src/shared/resize-image.ts`).
  An ISBN lookup asks knihovny.cz and the API at once (`isbn-lookup.ts`): for Czech and Slovak
  ISBNs (`978-80-…`) the libraries' details come first, for others the API's; each fills in
  what the other lacks, and the cover always comes through the API. E2E tests answer knihovny.cz
  with `e2e/czech-libraries.ts`.
- Loans in `src/features/loans/`, contacts in `src/features/contacts/`; their pages sit under
  `/loans` so the Loans tab stays highlighted. Lending to a new name creates the contact first
  (`ContactPicker`). Books, contacts, loans and stats show parts of each other, so every mutation
  calls `invalidateLibrary` (`src/app/library-queries.ts`).
- Shelves in `src/features/shelves/`, managed at `/books/shelves`; the books list takes its shelf
  from `?shelf=`, so a shelf can be linked to. Picking a reading status in the form dates the start
  or end today (`readingDatesForStatus` in the domain) — only on the reader's own choice, never
  when a stored book fills the form.
- ISBN scanning (`src/features/scanner/`): the native `BarcodeDetector` where it reads EAN-13,
  else the `barcode-detector` ponyfill, whose `.wasm` is served with the app (not from its default
  CDN) and loads only when a scan starts. `/books/new?scan=1` opens the scanner straight away.
  The e2e test films a generated barcode through Chromium's fake camera (`e2e/barcode-video.ts`).
- PWA: `UpdatePrompt` registers the service worker and offers a reload once a new version waits;
  `src/shared/install-prompt.ts` keeps Chrome's `beforeinstallprompt` (listened for in `main.ts`)
  and tells iOS readers to use the Share menu. The web's `icons` script draws the icons into
  `public/`. Czech plurals use `czechPluralForm` (`žádná | 1 | 2–4 | 5+`).
- `describeError(err, { conflict })` — a 409 means something different per action (e-mail taken,
  book lent out, …), so the caller names it. The query cache is cleared whenever the signed-in user
  changes (`main.ts`).
- `USelectMenu` needs an `aria-label`: Reka names its trigger "Show popup", which beats the
  `UFormField` label. Form grids use `grid-cols-1 sm:grid-cols-2` — an implicit column grows with
  a long, unwrapped placeholder and pushes the card's content sideways.
- `src/features/auth/session-store.ts` — Pinia store: who is signed in, and every action that
  changes it. Server state elsewhere goes through TanStack Query.
- Routing is in `src/app/router.ts`; `meta.requiresAuth` / `meta.guestOnly` / `meta.requiresRole`
  drive the guard. Layouts: `AppLayout` (signed in) and `GuestLayout` (sign-in and friends).
- UI is Nuxt UI v4 in plain-Vue mode; components auto-import, composables don't (import
  `useToast` from `@nuxt/ui/composables`). Icons are bundled at build time from literal names in
  `src/**/*.{vue,ts}` (`vite.config.ts`); a name only known at runtime would be fetched from the
  Iconify API. All texts go through vue-i18n (`src/locales/{cs,en}.json`) — including validation
  messages, keyed by issue code, with `validation.formats.*` naming formats such as `isbn`.
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

Phase 1 (skeleton, auth, account, announcements), phase 2 (books, ISBN lookup, covers), phase 3
(contacts, loans, dashboard) and phase 4 (shelves, reading dates and notes, barcode scanning,
installable PWA) are in place. Reminders and the admin section arrive in phase 5; the plan lives in
the user's Obsidian vault (`moje_projekty/Kniho-hlod`).
