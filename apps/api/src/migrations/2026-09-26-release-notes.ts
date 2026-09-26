import type { Migration } from '@eleansphere/be-core';

/** The last release before the app told readers what's new. */
const RELEASE_BEFORE_NOTES = '1.3';

/**
 * `users.lastSeenRelease`, for the app's "what's new". Readers who already use the app have seen
 * everything up to the release before the notes, so they are told about the ones after it.
 */
const STATEMENTS = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastSeenRelease" VARCHAR(255)`,
  `UPDATE "users" SET "lastSeenRelease" = '${RELEASE_BEFORE_NOTES}' WHERE "lastSeenRelease" IS NULL AND "onboardedAt" IS NOT NULL`,
];

export const releaseNotes: Migration = {
  name: '2026-09-26-release-notes',
  async up({ sequelize }) {
    for (const statement of STATEMENTS) await sequelize.query(statement);
  },
};
