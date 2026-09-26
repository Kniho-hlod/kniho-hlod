import type { Migration } from '@eleansphere/be-core';

const USER = `VARCHAR(255) NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE`;
const TIMESTAMPS = `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL`;

/**
 * Friends: `friendships`, the bell's `notifications`, the reader's sharing settings and invite
 * code. Books are shown to friends unless hidden (`visibility`, never used before): nothing is
 * shared until a reader turns `shareLibrary` on.
 */
const STATEMENTS = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "shareLibrary" BOOLEAN DEFAULT false`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailNotifications" BOOLEAN DEFAULT true`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "inviteCode" VARCHAR(255) UNIQUE`,
  `ALTER TABLE "books" ALTER COLUMN "visibility" SET DEFAULT 'friends'`,
  `UPDATE "books" SET "visibility" = 'friends' WHERE "visibility" IS DISTINCT FROM 'friends'`,
  `CREATE TABLE IF NOT EXISTS "friendships" ("id" VARCHAR(255) NOT NULL, "requesterId" ${USER}, "addresseeId" ${USER}, "status" VARCHAR(255) DEFAULT 'pending', "acceptedAt" TIMESTAMP WITH TIME ZONE, ${TIMESTAMPS}, PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "friendships_requester_id_addressee_id" ON "friendships" ("requesterId", "addresseeId")`,
  `CREATE INDEX IF NOT EXISTS "friendships_addressee_id" ON "friendships" ("addresseeId")`,
  `CREATE TABLE IF NOT EXISTS "notifications" ("id" VARCHAR(255) NOT NULL, "recipientId" ${USER}, "actorId" ${USER}, "kind" VARCHAR(255) NOT NULL, "readAt" TIMESTAMP WITH TIME ZONE, ${TIMESTAMPS}, PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "notifications_recipient_id" ON "notifications" ("recipientId")`,
];

export const friends: Migration = {
  name: '2026-09-27-friends',
  async up({ sequelize }) {
    for (const statement of STATEMENTS) await sequelize.query(statement);
  },
};
