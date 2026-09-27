import type { Migration } from '@eleansphere/be-core';

/** Comments under books; a deleted book or account takes its comments along. */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "comments" ("id" VARCHAR(255) NOT NULL, "bookId" VARCHAR(255) NOT NULL REFERENCES "books" ("id") ON DELETE CASCADE ON UPDATE CASCADE, "authorId" VARCHAR(255) NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE, "text" TEXT NOT NULL, "editedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "comments_book_id" ON "comments" ("bookId")`,
];

export const comments: Migration = {
  name: '2026-09-27-comments',
  async up({ sequelize }) {
    for (const statement of STATEMENTS) await sequelize.query(statement);
  },
};
