import type { Migration } from '@eleansphere/be-core';

const SAMPLE_TABLES = ['books', 'shelves', 'contacts', 'loans'] as const;

/**
 * The onboarding tour: `users.onboardedAt`, and `isSample` on the rows its sample library puts in.
 * Readers who signed up before the tour existed already know the app, so they count as onboarded.
 */
const STATEMENTS = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboardedAt" TIMESTAMP WITH TIME ZONE`,
  `UPDATE "users" SET "onboardedAt" = NOW() WHERE "onboardedAt" IS NULL`,
  ...SAMPLE_TABLES.map(
    (table) => `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "isSample" BOOLEAN DEFAULT false`
  ),
];

export const onboarding: Migration = {
  name: '2026-09-26-onboarding',
  async up({ sequelize }) {
    for (const statement of STATEMENTS) await sequelize.query(statement);
  },
};
