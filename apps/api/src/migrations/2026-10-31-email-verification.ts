import type { Migration } from '@eleansphere/be-core';

/**
 * Confirmed addresses and invite links that run out.
 * - `emailVerifiedAt`: readers who signed up before the confirmation e-mail count as confirmed;
 *   new accounts start without it.
 * - `inviteCodeIssuedAt`: links made before get their 30 days from today.
 * - E-mail addresses are kept in lower case (be-core stores them so): older ones are lowered too,
 *   except where that would clash with another account's address.
 */
const STATEMENTS = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP WITH TIME ZONE`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "inviteCodeIssuedAt" TIMESTAMP WITH TIME ZONE`,
  `UPDATE "users" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL`,
  `UPDATE "users" SET "inviteCodeIssuedAt" = now() WHERE "inviteCode" IS NOT NULL AND "inviteCodeIssuedAt" IS NULL`,
  `UPDATE "users" AS u SET "email" = lower(trim(u."email"))
     WHERE u."email" <> lower(trim(u."email"))
       AND NOT EXISTS (
         SELECT 1 FROM "users" AS other
          WHERE other."id" <> u."id" AND lower(trim(other."email")) = lower(trim(u."email"))
       )`,
];

export const emailVerification: Migration = {
  name: '2026-10-31-email-verification',
  async up({ sequelize }) {
    for (const statement of STATEMENTS) await sequelize.query(statement);
  },
};
