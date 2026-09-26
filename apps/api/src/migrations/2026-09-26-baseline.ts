import type { Migration } from '@eleansphere/be-core';

/**
 * The schema as `sync()` created it up to 2026-09-26 — production's tables were made that way —
 * frozen, so later model changes can't alter what this migration builds. `IF NOT EXISTS`
 * throughout: on a database `sync()` made, it changes nothing and is only recorded as applied;
 * on an empty one it creates everything. Table names are unqualified: the connection's
 * `search_path` puts them in the configured schema.
 */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "users" ("id" VARCHAR(255) NOT NULL, "email" VARCHAR(255) NOT NULL UNIQUE, "password" VARCHAR(255) NOT NULL, "displayName" VARCHAR(255) NOT NULL, "role" VARCHAR(255) DEFAULT 'user', "locale" VARCHAR(255) DEFAULT 'cs', "timezone" VARCHAR(255) DEFAULT 'Europe/Prague', "emailReminders" BOOLEAN DEFAULT true, "reminderDaysBefore" INTEGER DEFAULT 2, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("id"))`,
  `CREATE TABLE IF NOT EXISTS "systemNotifications" ("id" VARCHAR(255) NOT NULL, "title" VARCHAR(255) NOT NULL, "message" TEXT NOT NULL, "severity" VARCHAR(255) DEFAULT 'info', "activeFrom" TIMESTAMP WITH TIME ZONE NOT NULL, "activeTo" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("id"))`,
  `CREATE TABLE IF NOT EXISTS "books" ("id" VARCHAR(255) NOT NULL, "title" VARCHAR(255) NOT NULL, "author" VARCHAR(255), "isbn" VARCHAR(255), "publisher" VARCHAR(255), "publishedYear" INTEGER, "pageCount" INTEGER, "language" VARCHAR(255), "description" TEXT, "readingStatus" VARCHAR(255) DEFAULT 'none', "rating" INTEGER, "startedAt" DATE, "finishedAt" DATE, "notes" TEXT, "visibility" VARCHAR(255) DEFAULT 'private', "ownerId" VARCHAR(255) NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "books_owner_id" ON "books" ("ownerId")`,
  `CREATE TABLE IF NOT EXISTS "contacts" ("id" VARCHAR(255) NOT NULL, "name" VARCHAR(255) NOT NULL, "email" VARCHAR(255), "phone" VARCHAR(255), "note" TEXT, "linkedUserId" VARCHAR(255) REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE, "ownerId" VARCHAR(255) NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "contacts_owner_id" ON "contacts" ("ownerId")`,
  `CREATE TABLE IF NOT EXISTS "loans" ("id" VARCHAR(255) NOT NULL, "bookId" VARCHAR(255) NOT NULL REFERENCES "books" ("id") ON DELETE NO ACTION ON UPDATE CASCADE, "contactId" VARCHAR(255) NOT NULL REFERENCES "contacts" ("id") ON DELETE NO ACTION ON UPDATE CASCADE, "lentAt" DATE NOT NULL, "dueAt" DATE, "returnedAt" DATE, "note" TEXT, "lastReminderSentAt" TIMESTAMP WITH TIME ZONE, "ownerId" VARCHAR(255) NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "loans_owner_id" ON "loans" ("ownerId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "loans_book_id" ON "loans" ("bookId") WHERE "returnedAt" IS NULL`,
  `CREATE TABLE IF NOT EXISTS "shelves" ("id" VARCHAR(255) NOT NULL, "name" VARCHAR(255) NOT NULL, "color" VARCHAR(255) DEFAULT 'neutral', "sortOrder" INTEGER DEFAULT 0, "ownerId" VARCHAR(255) NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "shelves_owner_id" ON "shelves" ("ownerId")`,
  `CREATE TABLE IF NOT EXISTS "bookShelves" ("id" VARCHAR(255) NOT NULL, "bookId" VARCHAR(255) NOT NULL REFERENCES "books" ("id") ON DELETE CASCADE ON UPDATE CASCADE, "shelfId" VARCHAR(255) NOT NULL REFERENCES "shelves" ("id") ON DELETE CASCADE ON UPDATE CASCADE, "ownerId" VARCHAR(255) NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "book_shelves_owner_id" ON "bookShelves" ("ownerId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "book_shelves_book_id_shelf_id" ON "bookShelves" ("bookId", "shelfId")`,
  `CREATE TABLE IF NOT EXISTS "Files" ("id" VARCHAR(255) NOT NULL, "storageKey" VARCHAR(255) NOT NULL, "originalName" VARCHAR(255), "mimeType" VARCHAR(255) NOT NULL, "size" INTEGER NOT NULL, "checksum" VARCHAR(255), "visibility" VARCHAR(255) DEFAULT 'public', "ownerId" VARCHAR(255), "refType" VARCHAR(255), "refId" VARCHAR(255), "role" VARCHAR(255), "sortOrder" INTEGER DEFAULT 0, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "files_ref_type_ref_id_role" ON "Files" ("refType", "refId", "role")`,
  `CREATE INDEX IF NOT EXISTS "files_owner_id" ON "Files" ("ownerId")`,
  `CREATE TABLE IF NOT EXISTS "RefreshTokens" ("id" VARCHAR(255) NOT NULL, "userId" VARCHAR(255) NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE, "familyId" VARCHAR(255) NOT NULL, "secretHash" VARCHAR(255) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id" ON "RefreshTokens" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "refresh_tokens_family_id" ON "RefreshTokens" ("familyId")`,
];

export const baseline: Migration = {
  name: '2026-09-26-baseline',
  async up({ sequelize }) {
    for (const statement of STATEMENTS) await sequelize.query(statement);
  },
};
