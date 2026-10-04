import type { Migration } from '@eleansphere/be-core';

const USER = `VARCHAR(255) NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE`;
const TIMESTAMPS = `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL`;

/** Wish lists, and friends' promises to give a wished-for book (one giver per wish). */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "wishes" ("id" VARCHAR(255) NOT NULL, "title" VARCHAR(255) NOT NULL, "author" VARCHAR(255), "isbn" VARCHAR(255), "note" TEXT, "ownerId" ${USER}, ${TIMESTAMPS}, PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "wishes_owner_id" ON "wishes" ("ownerId")`,
  `CREATE TABLE IF NOT EXISTS "wishReservations" ("id" VARCHAR(255) NOT NULL, "wishId" VARCHAR(255) NOT NULL REFERENCES "wishes" ("id") ON DELETE CASCADE ON UPDATE CASCADE, "giverId" ${USER}, ${TIMESTAMPS}, PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "wish_reservations_wish_id" ON "wishReservations" ("wishId")`,
  `CREATE INDEX IF NOT EXISTS "wish_reservations_giver_id" ON "wishReservations" ("giverId")`,
];

export const wishes: Migration = {
  name: '2026-10-04-wishes',
  async up({ sequelize }) {
    for (const statement of STATEMENTS) await sequelize.query(statement);
  },
};
