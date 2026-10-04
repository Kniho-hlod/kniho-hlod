# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Kniho-hlod** — a Czech book-lending app (kniha = book): a personal library, the people you lend
books to, due dates and email reminders. Rebuilt from scratch in 2026-09; the previous three-repo
version is archived in `projekty/_archiv/kniho-hlod-legacy/`.

pnpm workspace, three packages:

| Package                                  | What it holds                                                                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain` (`@kniho-hlod/domain`) | Entity definitions, DTO types, domain rules. Shared by both apps; ships TypeScript source, no build step. No Node or DOM APIs (enforced by ESLint). |
| `apps/api` (`@kniho-hlod/api`)           | The REST API: `createCore` from `@eleansphere/be-core`, plus this project's configuration, file authorization, email templates and scripts.         |
| `apps/web` (`@kniho-hlod/web`)           | Vue 3 + Nuxt UI SPA, installable as a PWA.                                                                                                          |

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
  _same_ rules as the server and translates the issue codes.
- Cross-field rules (e.g. an announcement's date range) live in the domain package as pure
  functions, used by an API hook and by the form's `refine`.

## Backend

`apps/api/src/app-config.ts` is the whole backend, declared: models, route overrides, auth, email
and storage. `src/env.ts` reads and checks the environment; `src/index.ts` only starts it.

- Auth is be-core's: registration, login with rotating refresh tokens, `GET/PATCH/DELETE /api/auth/me`,
  password change and single-use reset links, rate limiting.
- Access: `user` is `admin`-only; `systemNotification` is `admin`-only, with a public
  `GET /api/system-notifications/active`; `book`, `contact`, `loan` and `shelf` are `owner`-only
  (another reader's row answers 404).
- Administration (`src/admin/`): administrators list accounts through `GET /api/users` (with
  `bookCount`) and delete them there — the only write `routes.user.access` allows; an account is
  created by registering and edited by its owner. Deleting takes the account's files along (as
  `DELETE /api/auth/me` does) and the database cascades to its library.
  `PUT /api/users/:id/role` changes a role. Neither ever touches the caller's own account, so an
  administrator is always left; a changed role reaches the token on its next renewal.
  `GET /api/admin/stats` counts the whole app (overdue in the default time zone) and how it is
  used: readers active in the last week (a refresh token issued: sign-in or renewal) and the
  returning ones among them, readers with 10+ books, invite links, friendships, new loans and
  borrow requests.
- Feedback (`src/feedback/`): any signed-in reader sends a bug report or idea with
  `POST /api/feedback` (rate-limited per reader); the plugin stores it with `reporterId` and the
  request's `User-Agent`, e-mails every administrator in their language (a failed e-mail is only
  logged) and answers the report, whose id the web uploads a `screenshot` file to — only the
  reporter may. Administrators own the CRUD routes at `/api/admin/feedback` (list with
  `reporter` and `screenshot`, PATCH `status`, DELETE); POST there is refused, every other field
  is `readOnly`. `newFeedback` in the admin stats counts unresolved reports.
- Onboarding: `user.onboardedAt` is empty until the reader finishes or skips the tour (the app
  sets it through `PATCH /api/auth/me`; accounts older than the tour were marked by the
  migration). The sample library (`src/sample-library/`): `GET /api/sample-library` says whether
  it can go in (`canFill`: no books, shelves or contacts) or is there (`present`); `POST` puts in
  the reader's locale's books, shelves, contacts and loans (one overdue, one due soon, one
  returned) in one transaction, 409 into a library that isn't empty; `DELETE` removes them with
  the loans of sample books and contacts. The rows carry `isSample` (`SAMPLE_FLAG_FIELD`,
  `readOnly`); the reminder job and the administrators' numbers leave them out.
- Friends (`src/friends/`, `src/notifications/`; plan in `~/.claude/plans/kniho-hlod-faze-3-komunita.md`):
  `friendship` (requester, addressee, `pending`/`accepted`) and `notification` have no CRUD
  routes — their plugins know both sides. `GET /api/friends` (each with `readingNow`),
  `…/requests`, `POST …/invitations` (by e-mail, rate-limited; the answer is the same whether
  the address has an account: a reader gets a request, anyone else the inviter's link),
  accept/decline/take back, `DELETE /api/friends/:userId`. Invite links: `GET/POST /api/me/invite`
  (the code is `user.inviteCode`, `readOnly` + `writeOnly`, never in a response of its own),
  `GET /api/invites/:code` (public: who invites), `POST …/accept` (friends at once).
  **A friend's library goes through its own routes** (`friend-library-plugin.ts`:
  `/api/friends/:userId/books|shelves`) with a whitelisted `FriendBook` — never widen `/api/books`
  access, which would hand out notes and borrowers' names. Only friends of a reader with
  `shareLibrary`, only books with `visibility = friends` and not samples; anything else is 404.
  `GET /api/notifications` + `POST …/read` feed the bell; e-mails (`emails/friend-request.ts`,
  `friend-invitation.ts`) only for requests and invitations, and only with `emailNotifications`.
- Lending between friends (`src/lending/`, phase 3b): `loanRequest` (book, requester, `lenderId`,
  message, suggested `dueAt`, `pending`/`accepted`/`declined`/`cancelled`, `loanId`; a partial
  unique index allows one waiting request per friend and book) has no CRUD routes.
  `POST /api/friends/:userId/books/:bookId/requests` asks for a shared book at home (409 when
  lent or asked already); `GET /api/loan-requests` lists both ways; accepting
  (`lend-to-friend.ts`, one transaction) finds the owner's contact for the friend
  (`friends/friend-contact.ts`) — linked already, or one with the friend's e-mail, which gets
  linked, or a new one named after them — lends the book from the owner's today (the due date chosen, suggested or a month) and declines
  the other waiting requests for it; decline and cancel answer one side each. Ending a friendship
  drops the waiting requests, never loans. `POST /api/friends/:userId/contact` hands the loan
  form the same contact for a friend (404 for anyone who isn't one). `GET /api/borrowed` is what the reader has out on
  loans to contacts linked to them. The bell and, with `emailNotifications`, e-mail tell each
  side (`emails/loan-request.ts`, `loan-request-answer.ts`); notifications carry `bookId`.
- Comments (`src/comments/`, phase 3c): `comment` (book, author, text, `editedAt`; no CRUD
  routes). `GET`/`POST /api/books/:id/comments`, `PATCH`/`DELETE /api/comments/:id`. A book's
  comments are for its owner and the owner's friends who see the book (shared, not hidden, not a
  sample) — anyone else, an ex-friend included, gets 404. The author edits and deletes; the book's
  owner deletes any under their book (`canEdit`/`canDelete` in each item). A comment by someone
  else rings the owner's bell (in-app only). Rate-limited per reader.
- What friends read (`src/feed/`, `src/recommendations/`, phase 3d): `GET /api/feed` pages the
  shared books of the reader's sharing friends that are being read, finished or wanted — one item
  per book, dated by `finishedAt`/`startedAt` (else the last change) or the day it was added,
  computed at read time, so hiding a book or turning sharing off takes it out at once. Books carry
  `review` (for friends, beside the rating; `notes` stay private), which `FriendBook` whitelists.
  `GET /api/friend-copies?isbn=` lists friends' shared copies of one book, each with `lent`
  (`FriendLibrary.lentUntil`; not under `/api/friends`, whose `:userId` route would catch it); `FriendBook.myCopy` is the reader's copy
  by ISBN. `POST /api/friends/:userId/books/:bookId/copy` puts a shared book in the reader's
  library as `want` (`books/copy-book.ts`: details and a copied cover file, never the rating,
  review, notes or dates; 409 when the reader has the ISBN). `recommendation` (no CRUD routes):
  `POST /api/recommendations` sends the reader's own book (not a sample) to friends with a
  message, once per waiting book and friend, and rings their bell; `GET` lists the waiting ones,
  `…/:id/accept` copies the book (or finds the reader's copy), `…/dismiss` sets it aside. Ending a
  friendship drops the waiting ones.
- Release notes: `user.lastSeenRelease` (a profile field) is the newest release whose notes the
  reader has seen; migration `2026-09-26-release-notes` set readers who already used the app to
  `1.3`, the release before the notes. The releases themselves live in the web app.
- Schema: `syncMode: 'migrate'` — the API applies pending `src/migrations/` on startup. The first,
  `2026-09-26-baseline`, is the DDL `sync()` generated until then, frozen, `IF NOT EXISTS`
  throughout (a no-op on production, which `sync()` built). A model change needs a new migration:
  `migrations.integration.test.ts` compares a migrated schema with a `sync()`ed one (columns,
  indexes, constraints). Integration tests all run on migrated schemas.
- Reminders (`src/jobs/`): `node dist/jobs.cjs loan-reminders` (locally
  `pnpm --filter @kniho-hlod/api job loan-reminders`) creates the core without migrating, sends
  each reader with `emailReminders` one e-mail (`src/emails/loan-reminder.ts`, in their locale)
  about the loans `loanReminderDue` picks — due soon once from `reminderDaysBefore` days ahead,
  overdue the day after and then weekly — and stamps `lastReminderSentAt`. Days are the reader's,
  so a second run the same day sends nothing; a failed e-mail is retried on the next run. The same
  job then reminds friends who borrowed a book (a loan to a contact linked to their account) by
  their own settings (`jobs/borrower-reminders.ts`, `emails/borrowed-reminder.ts`, stamping
  `lastBorrowerReminderSentAt`); nobody else a book was lent to is ever e-mailed.
  Last, the weekly e-mail (`jobs/weekly-digest.ts`, `emails/weekly-digest.ts`; also alone as the
  `weekly-digest` job): on Sunday in the reader's zone, readers with `weeklyDigest` (on by default,
  a switch in `SharingCard`) hear what their sharing friends started, finished or want to read
  since the last one (the feed's rules, a week at most) and how many friend requests, borrow
  requests and recommendations wait; nothing to say, no e-mail. `lastDigestSentAt` (`readOnly` +
  `writeOnly`) keeps it weekly.
- Books: the route hooks reject an invalid ISBN and reading dates out of order, and store the ISBN
  as ISBN-13. Every book the API returns carries `cover` (`src/books/book-covers.ts`), and a
  deleted book takes its cover with it.
- `GET /api/isbn/:isbn` (`src/isbn/`, one file per catalogue) asks Open Library
  (`/isbn/{isbn}.json`, author names from `/authors/…`), then Google Books: the details from the
  first that knows the ISBN, the cover from the first that has one. Answers are cached. Czech and
  Slovak ISBNs ask Trh knih first (`trh-knih.ts`), the second-hand market, which knows about half
  of Czech books (few new ones) with sellers' photos of the covers: it has no public API, so its
  search (`/hledat?q=`, a 302 to the book when known) and the book page's schema.org JSON-LD are
  read, once per lookup. knihovny.cz refuses cloud addresses its covers too (418), and Obálky
  knih's API is for libraries only. The form asks `…/cover` after every lookup. A 404
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
- Library import (`src/library-import/`): the app reads another app's export in the browser
  (`readLibraryTable` in the domain: Goodreads' CSV, Databáze knih's Excel table or any table
  with a title column, headings matched without accents) and sends `POST /api/library/import`
  up to `LIBRARY_IMPORT_MAX_BOOKS` books at a time; the server fits each again
  (`fitImportedBook`), leaves out the reader's books with the same ISBN or title and author
  (`importKeys`), makes missing shelves and inserts in one transaction.
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
- Deploy: Railway builds `apps/api/Dockerfile` on every push to `main` that touches the API. Both
  Railway services (`kniho-hlod-backend`, cron `kniho-hlod-reminders`) are configured in their
  service settings — Dockerfile path, watch paths, healthcheck, start command, schedule — not in
  `railway.json`, which Railway stops reading on 2026-12-01; change them there (or with the
  Railway MCP's `update-service`). `NODE_AUTH_TOKEN` arrives as a build arg; never name it in a
  `RUN` line — BuildKit prints RUN lines with args expanded, which once leaked the token into the
  build log.
  It reaches pnpm through the `${NODE_AUTH_TOKEN}` placeholder in `tooling/user.npmrc`, which
  the Vercel build (`apps/web/vercel.json`) copies the same way. The reminders run as the cron
  service on the same Dockerfile (start `node dist/jobs.cjs loan-reminders`, `0 5 * * *` UTC, no
  restart), with the API's variables as references (`${{kniho-hlod-backend.…}}`,
  `${{shared.NODE_AUTH_TOKEN}}`).

## Frontend

- `src/app/api.ts` — the `AuthSession` (tokens, automatic renewal after a 401) and the service
  container. Everything else imports `services` from here. Show uploaded files through
  `fileUrl(file)`: without a CDN the API answers with its own `/api/files/:id` path, which lives
  on the API's origin, not the app's.
- Startup: `main.ts` mounts at once and `App.vue` shows `SplashScreen` (the bookworm picture,
  `src/assets/splash.webp`, preloaded and precached, with jokes from `splash.lines`). The router
  guard awaits `session.restore()` — loaded once, never rejecting — so a reload of a signed-in
  page doesn't bounce to sign-in; `useStartup` lifts the splash once the first page is ready and
  `MIN_SPLASH_MS` has passed — one shared state, which the tour waits for too. E2E clicks wait
  for it on every `page.goto`.
- Books live in `src/features/books/` (vue-query composables in `api.ts`, form state in
  `book-form.ts`); covers are scaled to WebP in the browser (`src/shared/resize-image.ts`).
  An ISBN lookup asks knihovny.cz and the API at once (`isbn-lookup.ts`): for Czech and Slovak
  ISBNs (`978-80-…`) the libraries' details come first, for others the API's; each fills in
  what the other lacks, and the cover always comes through the API. E2E tests answer knihovny.cz
  with `e2e/czech-libraries.ts`.
- Loans in `src/features/loans/`, contacts in `src/features/contacts/`; their pages sit under
  `/loans` so the Loans tab stays highlighted. `ContactPicker` offers contacts and friends (a
  friend becomes their linked contact on saving) and lending to a new name creates the contact
  first. Books, contacts, loans and stats show parts of each other, so every mutation
  calls `invalidateLibrary` (`src/app/library-queries.ts`).
- Shelves in `src/features/shelves/`, managed at `/books/shelves`; the books list takes its shelf
  from `?shelf=` and its reading status from `?status=` (the overview's reading tile links it), so
  both can be linked to. Picking a reading status in the form dates the start
  or end today (`readingDatesForStatus` in the domain) and moving a book back clears the dates
  that no longer hold — only on the reader's own choice, never when a stored book fills the form.
  The book page moves a book on with one tap; any other status waits in its "…" menu.
- Library import at `/books/import` (`BookImportPage`, `src/features/library-import/`), linked
  with the shelf scan from the empty library, the books page's "Hromadně" menu and
  `LibraryQuickStart` (over a library under `QUICK_START_UNTIL` books, until hidden; the choice
  is kept in `localStorage`): CSV (UTF-8, else Windows-1250) or
  `.xlsx`, read by `src/shared/read-xlsx.ts` with the browser's own unzipping, no spreadsheet
  library; a preview, then parts of ≤ 100 books and ~80 kB (`importBatches`, the API reads
  100 kB at most).
- Shelf scan at `/books/scan` (`ShelfScanPage`, `src/features/shelf-scan/`): `ScannerViewfinder`
  with `continuous` keeps filming and ignores the same barcode for a moment; `createShelfScan`
  looks each new ISBN up (`lookUpIsbn`) and checks the library (`findBookByIsbn`); unknown books
  get a typed title, owned ones are left out. "Přidat" creates them one by one through
  `addScannedBook` (details, the chosen shelves, the catalogue's cover).
- ISBN scanning (`src/features/scanner/`): the native `BarcodeDetector` where it reads EAN-13,
  else the `barcode-detector` ponyfill, whose `.wasm` is served with the app (not from its default
  CDN) and loads only when a scan starts. `/books/new?scan=1` opens the scanner straight away;
  `/books/new?isbn=` fills the new book from the catalogues. "Mám ji už?" on the books page
  (`BookCheckDialog`) scans a book and says whether the reader has it (`?isbn=` on books), with
  "Přidat do knihovny" for one they don't, and the friends who share a copy, those with it at
  home first, each opening their copy to ask for it. `CoverPicker` offers "Vyfotit obálku" (the camera, on
  touch devices) and the form says when the catalogues know a book but have no cover — common for
  Czech editions: knihovny.cz's covers come from Obálky knih, whose API is only for registered
  libraries.
  The e2e test films a generated barcode through Chromium's fake camera (`e2e/barcode-video.ts`).
- PWA: `UpdatePrompt` registers the service worker and offers a reload once a new version waits;
  `src/shared/install-prompt.ts` keeps Chrome's `beforeinstallprompt` (listened for in `main.ts`)
  and tells iOS readers to use the Share menu. The app's mark is the bookworm from the first
  Kniho-hlod's favicon, redrawn in `src/assets/bookworm.svg`: `AppLogo` shows it, and the web's
  `icons` script draws the favicon and the PWA icons from it into `public/`. A shared link's
  preview is Open Graph in `index.html` (no `og:url`, so invite links stay themselves); its picture
  `public/og-image.jpg` comes from the `share-image` script (splash + logo card). Czech plurals use
  `czechPluralForm` (`žádná | 1 | 2–4 | 5+`); shelves are „poličky“ in Czech.
- Administration under `/admin` (`meta.requiresRole: 'admin'`, a nav item only administrators
  see): the overview with `GET /api/admin/stats`, accounts (`src/features/admin/`) and
  announcements (`src/features/announcements/`: the form edits times as `datetime-local` in the
  device's zone and sends ISO; `SEVERITY_STYLES` is shared with the banner). A role change shows
  in the other account's app after its next sign-in. The admin e2e test makes its administrator
  with `seed:admin`, as production does (helpers in `e2e/accounts.ts`).
- Feedback (`src/features/feedback/`): "Nahlásit chybu nebo nápad" in the account menu opens
  `FeedbackModal` (kind, message, optional screenshot shrunk to WebP); the report carries the
  route, the window size and the release with the build (`1.4 · 2ee4ac0`). Administrators
  resolve reports at `/admin/feedback`; the overview's section shows how many are new.
- The onboarding tour (`src/features/onboarding/`, mounted in `AppLayout`): `OnboardingTour`
  greets a reader without `onboardedAt` on the home page once the splash screen is gone
  (`TourWelcome`: the bookworm, an offer of the sample library while the library is empty,
  "Přeskočit"), then walks `TOUR_STEPS` — each opens its page and `TourSpotlight` rings the
  element marked `data-tour` (`TOUR_TARGETS`), dims the rest and scrolls to it once the page has
  settled. `TourGuide` is the card with the peeking bookworm, "Ukončit" on every step. The
  account menu starts it again; `SampleLibraryCard` on the account page and
  `SampleLibraryBanner` over every other page (once the tour is closed; "Zatím nechat" hides it
  until a reload) remove the samples, and sample books wear an "Ukázka" badge. A new element the
  tour points at needs a `data-tour` mark.
  E2E accounts made through the API are marked onboarded (`e2e/accounts.ts`); a test that
  registers on screen calls `skipTour` first — the greeting hides the page from `getByRole`.
- Friends (`src/features/friends/`, pages `Friends`, `Friend`, `FriendBook`, `Invite`): the
  Friends tab (its badge counts incoming requests; on a phone administration moved to the
  account menu to make room), `InviteCard` (link, share, QR code drawn by `uqr` in the browser,
  a new link, invitation by e-mail), a friend's library read-only with their shelves (`?shelf=`),
  `SharingCard` on the account page, "Skrýt před přáteli" in the book form, "Přátelé právě čtou"
  on the home page. `/invite/:code` works signed in or out (GuestLayout); sign-up and sign-in
  keep `?redirect=` and come back. A friend's reading status reads in the third person
  (`ReadingStatusBadge reader="friend"`). The bell (`src/features/notifications/`) polls every
  minute and on focus. The tour has a Friends step.
- Lending (`src/features/lending/`): `RequestBookPanel` on a friend's book (message, suggested
  date; the waiting request with "Zrušit žádost"), `IncomingLoanRequests` on the home and loans
  pages (`LoanRequestCard` asks for the due date before lending), the Loans page's third tab
  `?tab=borrowed` (`BorrowedList`: books from friends and the reader's waiting requests), "Mám
  půjčené od přátel" on the home page. The Loans tab's badge counts overdue loans and waiting
  requests; a contact linked to an account says "Přítel v Kniho-hlodu".
- Comments (`src/features/comments/BookComments.vue`): under a friend's book, and under the
  reader's own book — inviting the first comment while friends see the book, otherwise shown only
  when some exist (`whenEmpty: 'invite' | 'hide'`). Edit and delete wait behind "…".
- What friends read (`src/features/feed/`, `src/features/recommendations/`): the Friends page
  opens on "Novinky" (`?tab=feed`, `FeedList`) when the reader has friends, else on
  `?tab=people` (the tour's Friends step asks for that tab); "Přátelé právě čtou" links to it.
  `FriendsOnBook` ("Přátelé o této knize") sits under the reader's and a friend's book; a friend's
  book offers "Chci si ji přečíst" (or "Máte ji v knihovně"). The book form has "Recenze pro
  přátele" (`BookReview` shows it). "Doporučit přátelům" waits in a book's "…" menu
  (`RecommendModal`); `IncomingRecommendations` on the home page takes or sets them aside.
- Versions and release notes (`src/features/releases/`): `RELEASES` in `releases.ts` is the one
  source — newest first, each with a version (`1.4`), a date, a title and notes in every language
  (content, so it lives there rather than in the locale files; the types demand both languages).
  `CURRENT_RELEASE` is the first; `BUILD` is the commit (`VITE_APP_VERSION`, from Vercel's
  `VERCEL_GIT_COMMIT_SHA` in `vite.config.ts`, else `dev`). The account menu and the foot of the
  account page (`AppVersion`) show both and open the history. `WhatsNew` (in `AppLayout`) shows
  the releases newer than `lastSeenRelease` once, after the splash screen and never over the
  tour, and records the current release when closed; a reader without one is recorded quietly.
  **A change readers notice adds a release on top of `RELEASES`** — the next number, today's
  date, notes written for readers in Czech and English; `releases.test.ts` checks the order and
  the languages. A fix readers wouldn't notice deploys without one.
- Privacy (`/privacy`, `PrivacyPage`, for visitors and readers alike, linked from sign-up and
  `AppVersion`): the text is content in `src/features/privacy/privacy-policy.ts`, per language.
  **A change to what the app stores or whom it sends data to updates it** and
  `PRIVACY_POLICY_DATE`.
- The look ("playful and bold": indigo and orange on warm paper, ink outlines, stuck-on shadows)
  lives in two places: `ui.config.ts` themes Nuxt UI's components (colours, 2px rings on cards
  and fields, solid buttons that press flat) and `src/assets/main.css` holds the tokens — the
  `ink` neutral palette, `paper` and `line` colours, `shadow-pop`/`shadow-pop-sm`, `bg-dots`.
  Headings use Bricolage Grotesque (`font-display`), text Inter; both are bundled through
  `@fontsource-variable`, no font CDN. Colours picked at runtime come from maps of literal class
  strings (`TILE_COLORS`, `STATUS_STYLES`, `CHIP_STYLES`, `COVER_PALETTES`), never built names.
  Everything clickable answers the pointer: `main.css` gives buttons and clickable roles the hand
  cursor (Tailwind 4 and Nuxt UI leave the arrow), outlined buttons lift on hover
  (`LIFTS_ON_HOVER`), quiet ones darken; a new clickable element needs a hover of its own.
  `ui.config.ts` is Vite config: after editing it, check the dev server restarted with the change.
- A book without an image gets a drawn cover (`features/books/generated-cover.ts`,
  `GeneratedCover.vue`): colours and a motif picked from a hash of the title, so it stays the
  same; `PersonAvatar` gives people the same palette by name. Loans say how far off the due date
  is ("za 3 dny", "5 dní po termínu") through `loanDue` and `LoanDueChip`.
- Shared pieces in `src/components/`: `EmptyState` (`page` or `section` size), `FormActions` (a
  form's save bar, stuck above the phone's tab bar), `NavLink` (`data-active` for Tailwind),
  `AccountMenu` (theme, language and signing out live under the avatar — e2e signs out there),
  `PasswordInput` (an eye button shows the password — so e2e finds the field with
  `getByLabel('Heslo', { exact: true })`), `PeekingBookworm` (moods: watching, shy, sad,
  happy — on the sign-in card and in the tour).
- Guest pages: `GuestLayout` shows the splash picture beside the form (a strip above it on a
  phone); the sign-in card has `PeekingBookworm` on its top edge, whose `mood` watches the form,
  shuts its eyes while the password field has focus and sulks after a failed sign-in.
- Toasts (`TOASTER` in `App.vue`) appear at the top and go after 2 s; one that needs an answer
  sets `duration: 0` (`UpdatePrompt`).
  Destructive actions wait behind a "…" menu (`common.moreActions`), not beside Edit.
- `pnpm --filter @kniho-hlod/web seed:demo` registers a demo account on the local API with
  books, covers, shelves, contacts and loans in every state, for checking how things look.
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
  messages, keyed by issue code, with `validation.formats.*` naming formats such as `isbn`. The
  release notes and the sample library are content, kept per language in their own files.
  vue-i18n reads `@` as a linked message: write `{'@'}` (an e-mail placeholder once broke a
  whole page); `i18n.test.ts` compiles every message in both languages.
- Every `UForm` binds `:validate-on="VALIDATE_ON"` (`src/app/validation.ts`). Nuxt UI's default
  also validates on blur, so leaving an untouched field shows an error and shifts the layout under
  the pointer — the link or button being clicked moves away and the click is lost.
- E2E: Playwright reuses servers already running on :3000/:5173, and `DATABASE_URL` from the
  environment beats `apps/api/.env`. Make sure both point at the local containers before a run.
  The suite signs up more readers than the sign-up limit allows from one address: run the API
  with `RATE_LIMITS=off` (in `apps/api/.env`; Playwright sets it for a server it starts).
  Migrations run in array order; their names only have to be unique.

## Commands

```bash
docker compose up -d      # Postgres :5434, Mailpit :8025 (SMTP :1025)
pnpm dev                  # API :3000 + web :5173
pnpm lint / typecheck / test / build
pnpm test:e2e             # Playwright; needs the containers and both .env files
pnpm --filter @kniho-hlod/api seed:admin
pnpm --filter @kniho-hlod/api job loan-reminders
```

## Conventions

- TypeScript everywhere, `verbatimModuleSyntax` (use `import type`), no `any`.
- Prettier: 100 columns, single quotes, semicolons. ESLint flat config at the root.
- Czech is the default language; keys live in both locale files.
- Don't commit unless asked — implement, verify, then stop.
- A change readers notice comes with a release in `apps/web/src/features/releases/releases.ts`.

## Status

Phase 1 (skeleton, auth, account, announcements), phase 2 (books, ISBN lookup, covers), phase 3
(contacts, loans, dashboard), phase 4 (shelves, reading dates and notes, barcode scanning,
installable PWA), phase 5 (loan reminders, administration, migrations) and phase 6 (the
visual redesign, the splash screen and the bookworm mark) are in place, with feedback reports,
the onboarding tour with its sample library, versioned release notes and friends (phase 3a:
friendships, invites, shared libraries, the bell), lending between friends (3b: requests, linked
contacts, borrowed books, reminders to borrowers), comments (3c) and what friends read (3d: the
feed, reviews, friends' copies of a book, copying a friend's book, recommendations) since. The plan
lives in the user's Obsidian vault (`moje_projekty/Kniho-hlod`).
