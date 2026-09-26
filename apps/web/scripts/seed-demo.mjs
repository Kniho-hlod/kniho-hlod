/**
 * Fills a LOCAL API with a demo library — books with and without covers, shelves, contacts and
 * loans in every state — for checking how the app looks. It registers a new account each run and
 * prints its sign-in details. It refuses any API that isn't on this machine.
 *
 *     pnpm --filter @kniho-hlod/web seed:demo            (API on http://localhost:3000)
 *     API_URL=http://localhost:3001 pnpm --filter @kniho-hlod/web seed:demo
 */
import { randomBytes } from 'node:crypto';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const PASSWORD_BYTES = 12;
const MILLISECONDS_PER_DAY = 86_400_000;

const SHELVES = [
  { name: 'Oblíbené', color: 'red' },
  { name: 'Klasika', color: 'amber' },
  { name: 'Sci-fi', color: 'violet' },
  { name: 'Pro děti', color: 'green' },
];

/** With an ISBN, the catalogues fill in the details and the cover; without one, a cover is drawn. */
const BOOKS = [
  {
    key: 'potter',
    isbn: '9780747532699',
    title: 'Harry Potter a Kámen mudrců',
    author: 'J. K. Rowling',
    readingStatus: 'read',
    rating: 5,
    shelves: ['Oblíbené', 'Pro děti'],
  },
  {
    key: '1984',
    isbn: '9780451524935',
    title: '1984',
    author: 'George Orwell',
    readingStatus: 'read',
    rating: 5,
    shelves: ['Klasika'],
  },
  {
    key: 'foundation',
    isbn: '9780553293357',
    title: 'Nadace',
    author: 'Isaac Asimov',
    readingStatus: 'reading',
    shelves: ['Sci-fi'],
  },
  {
    key: 'pride',
    isbn: '9780141439518',
    title: 'Pýcha a předsudek',
    author: 'Jane Austen',
    readingStatus: 'want',
    shelves: ['Klasika'],
  },
  {
    key: 'brave',
    isbn: '9780060850524',
    title: 'Konec civilizace',
    author: 'Aldous Huxley',
    readingStatus: 'read',
    rating: 4,
    shelves: ['Sci-fi', 'Klasika'],
  },
  {
    key: 'hunger',
    isbn: '9780439023481',
    title: 'Hunger Games',
    author: 'Suzanne Collins',
    readingStatus: 'reading',
    rating: 3,
    shelves: [],
  },
  {
    key: 'alchemist',
    isbn: '9780062315007',
    title: 'Alchymista',
    author: 'Paulo Coelho',
    readingStatus: 'none',
    shelves: [],
  },
  {
    key: 'saturnin',
    title: 'Saturnin',
    author: 'Zdeněk Jirotka',
    readingStatus: 'read',
    rating: 5,
    shelves: ['Oblíbené'],
  },
  {
    key: 'krakatit',
    title: 'Krakatit',
    author: 'Karel Čapek',
    readingStatus: 'none',
    shelves: ['Klasika', 'Sci-fi'],
  },
  {
    key: 'prince',
    title: 'Malý princ',
    author: 'Antoine de Saint-Exupéry',
    readingStatus: 'read',
    rating: 5,
    shelves: ['Pro děti', 'Oblíbené'],
  },
];

const CONTACTS = [
  { key: 'petr', name: 'Petr Novák', email: 'petr@example.com', phone: '+420 777 123 456' },
  { key: 'lucie', name: 'Lucie Dvořáková', email: 'lucie@example.com' },
  { key: 'tomas', name: 'Tomáš', note: 'Soused z třetího patra' },
];

/** Days from today: one loan overdue, one due soon, one with time left, one returned. */
const LOANS = [
  { book: 'potter', contact: 'petr', lentDaysAgo: 40, dueInDays: -5 },
  { book: 'brave', contact: 'lucie', lentDaysAgo: 20, dueInDays: 3 },
  { book: 'saturnin', contact: 'tomas', lentDaysAgo: 3, dueInDays: 30 },
  { book: '1984', contact: 'lucie', lentDaysAgo: 90, dueInDays: -60, returned: true },
];

const READING_DAYS_AGO = { started: 60, finished: 40, reading: 12 };

function requireLocalApi() {
  const { hostname } = new URL(API_URL);
  if (!LOCAL_HOSTS.includes(hostname)) {
    throw new Error(`seed:demo only fills a local API, not ${API_URL}`);
  }
}

function dateInDays(days) {
  return new Date(Date.now() + days * MILLISECONDS_PER_DAY).toISOString().slice(0, 10);
}

function readingDates(readingStatus) {
  if (readingStatus === 'reading') return { startedAt: dateInDays(-READING_DAYS_AGO.reading) };
  if (readingStatus === 'read') {
    return {
      startedAt: dateInDays(-READING_DAYS_AGO.started),
      finishedAt: dateInDays(-READING_DAYS_AGO.finished),
    };
  }
  return {};
}

async function call(method, path, { token, json, form } = {}) {
  const response = await fetch(API_URL + path, {
    method,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(json && { 'Content-Type': 'application/json' }),
    },
    body: form ?? (json && JSON.stringify(json)),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function importCover(token, bookId, isbn) {
  const cover = await call('GET', `/api/isbn/${isbn}/cover`, { token });
  const form = new FormData();
  const image = new Blob([Buffer.from(cover.base64, 'base64')], { type: cover.mimeType });
  form.append('file', image, 'cover');
  form.append('refType', 'book');
  form.append('refId', bookId);
  form.append('role', 'cover');
  await call('POST', '/api/files', { token, form });
}

async function addBook(token, shelfIds, { key, isbn, shelves, ...book }) {
  const created = await call('POST', '/api/books', {
    token,
    json: { ...book, ...(isbn && { isbn }), ...readingDates(book.readingStatus) },
  });
  if (shelves.length > 0) {
    await call('PUT', `/api/books/${created.id}/shelves`, {
      token,
      json: { shelfIds: shelves.map((name) => shelfIds.get(name)) },
    });
  }
  if (isbn) {
    // The catalogues are on the internet; a book without its cover is still a fine demo.
    await importCover(token, created.id, isbn).catch((error) =>
      console.warn(`No cover for ${book.title}: ${error.message}`)
    );
  }
  return [key, created.id];
}

async function main() {
  requireLocalApi();
  const email = `demo-${Date.now()}@kniho-hlod.local`;
  const password = randomBytes(PASSWORD_BYTES).toString('base64url');
  const { token } = await call('POST', '/api/auth/register', {
    json: { email, password, displayName: 'Jana Čtenářová', locale: 'cs' },
  });

  const shelfIds = new Map();
  for (const shelf of SHELVES) {
    shelfIds.set(shelf.name, (await call('POST', '/api/shelves', { token, json: shelf })).id);
  }
  const bookIds = new Map();
  for (const book of BOOKS) bookIds.set(...(await addBook(token, shelfIds, book)));
  const contactIds = new Map();
  for (const { key, ...contact } of CONTACTS) {
    contactIds.set(key, (await call('POST', '/api/contacts', { token, json: contact })).id);
  }
  for (const loan of LOANS) {
    const created = await call('POST', '/api/loans', {
      token,
      json: {
        bookId: bookIds.get(loan.book),
        contactId: contactIds.get(loan.contact),
        lentAt: dateInDays(-loan.lentDaysAgo),
        dueAt: dateInDays(loan.dueInDays),
      },
    });
    if (loan.returned) await call('POST', `/api/loans/${created.id}/return`, { token });
  }

  console.info(`Demo library ready. Sign in as ${email} with the password ${password}`);
}

await main();
