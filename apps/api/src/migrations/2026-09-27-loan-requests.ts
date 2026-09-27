import type { Migration } from '@eleansphere/be-core';

const USER = `VARCHAR(255) NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE`;
const TIMESTAMPS = `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL`;

/**
 * Lending between friends: `loanRequests` (one waiting per friend and book), the book a
 * notification is about, and when the friend who borrowed a book was last reminded.
 */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "loanRequests" ("id" VARCHAR(255) NOT NULL, "bookId" VARCHAR(255) NOT NULL REFERENCES "books" ("id") ON DELETE CASCADE ON UPDATE CASCADE, "requesterId" ${USER}, "lenderId" ${USER}, "message" TEXT, "dueAt" DATE, "status" VARCHAR(255) DEFAULT 'pending', "loanId" VARCHAR(255) REFERENCES "loans" ("id") ON DELETE SET NULL ON UPDATE CASCADE, "answeredAt" TIMESTAMP WITH TIME ZONE, ${TIMESTAMPS}, PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "loan_requests_book_id_requester_id" ON "loanRequests" ("bookId", "requesterId") WHERE "status" = 'pending'`,
  `CREATE INDEX IF NOT EXISTS "loan_requests_lender_id" ON "loanRequests" ("lenderId")`,
  `ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "bookId" VARCHAR(255) REFERENCES "books" ("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "lastBorrowerReminderSentAt" TIMESTAMP WITH TIME ZONE`,
];

export const loanRequests: Migration = {
  name: '2026-09-27-loan-requests',
  async up({ sequelize }) {
    for (const statement of STATEMENTS) await sequelize.query(statement);
  },
};
