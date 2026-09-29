import type { Migration } from '@eleansphere/be-core';

const USER = `VARCHAR(255) NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE`;
const TIMESTAMPS = `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL`;

/**
 * What friends read: a book's review for friends, indexes for the feed and for finding a book by
 * ISBN across libraries, and the books readers recommend to their friends.
 */
const STATEMENTS = [
  `ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "review" TEXT`,
  `CREATE INDEX IF NOT EXISTS "books_owner_id_finished_at" ON "books" ("ownerId", "finishedAt")`,
  `CREATE INDEX IF NOT EXISTS "books_owner_id_started_at" ON "books" ("ownerId", "startedAt")`,
  `CREATE INDEX IF NOT EXISTS "books_isbn" ON "books" ("isbn")`,
  `CREATE TABLE IF NOT EXISTS "recommendations" ("id" VARCHAR(255) NOT NULL, "bookId" VARCHAR(255) NOT NULL REFERENCES "books" ("id") ON DELETE CASCADE ON UPDATE CASCADE, "senderId" ${USER}, "recipientId" ${USER}, "message" TEXT, "status" VARCHAR(255) DEFAULT 'pending', "bookCopyId" VARCHAR(255) REFERENCES "books" ("id") ON DELETE SET NULL ON UPDATE CASCADE, "answeredAt" TIMESTAMP WITH TIME ZONE, ${TIMESTAMPS}, PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "recommendations_book_id_recipient_id" ON "recommendations" ("bookId", "recipientId") WHERE "status" = 'pending'`,
  `CREATE INDEX IF NOT EXISTS "recommendations_recipient_id" ON "recommendations" ("recipientId")`,
];

export const readingFeed: Migration = {
  name: '2026-09-29-reading-feed',
  async up({ sequelize }) {
    for (const statement of STATEMENTS) await sequelize.query(statement);
  },
};
