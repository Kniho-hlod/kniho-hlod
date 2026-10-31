import type { Migration } from '@eleansphere/be-core';

/** The weekly e-mail about friends: whether the reader wants it and when it last went out. */
const STATEMENTS = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "weeklyDigest" BOOLEAN DEFAULT true`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastDigestSentAt" TIMESTAMP WITH TIME ZONE`,
];

export const weeklyDigest: Migration = {
  name: '2026-10-04-weekly-digest',
  async up({ sequelize }) {
    for (const statement of STATEMENTS) await sequelize.query(statement);
  },
};
