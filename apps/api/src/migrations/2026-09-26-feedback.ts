import type { Migration } from '@eleansphere/be-core';

/** Readers' reports to the administrators (`feedback`). Deleting an account deletes its reports. */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "feedbacks" ("id" VARCHAR(255) NOT NULL, "kind" VARCHAR(255) DEFAULT 'bug', "message" TEXT NOT NULL, "pageUrl" VARCHAR(255), "appVersion" VARCHAR(255), "viewport" VARCHAR(255), "userAgent" VARCHAR(255), "reporterId" VARCHAR(255) NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE, "status" VARCHAR(255) DEFAULT 'new', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("id"))`,
];

export const feedback: Migration = {
  name: '2026-09-26-feedback',
  async up({ sequelize }) {
    for (const statement of STATEMENTS) await sequelize.query(statement);
  },
};
