import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCore, createSequelize, MIGRATIONS_TABLE } from '@eleansphere/be-core';
import type { Sequelize } from '@eleansphere/be-core';
import { buildAppConfig } from './app-config';
import { startTestApp, TEST_DATABASE_URL, testEnvironment } from './test-support/test-app';
import type { TestApp } from './test-support/test-app';

interface SchemaRow {
  [column: string]: unknown;
}

/** The schema's tables, columns, indexes and constraints, with its name taken out. */
async function describeSchema(database: Sequelize, schema: string) {
  const select = async (sql: string) => {
    const [rows] = await database.query(sql, { bind: [schema] });
    return JSON.parse(JSON.stringify(rows).replaceAll(`${schema}.`, '')) as SchemaRow[];
  };
  return {
    columns: await select(`
      SELECT table_name, column_name, data_type, is_nullable, column_default,
             character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name <> '${MIGRATIONS_TABLE}'
      ORDER BY table_name, column_name`),
    indexes: await select(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = $1 AND tablename <> '${MIGRATIONS_TABLE}'
      ORDER BY tablename, indexname`),
    constraints: await select(`
      SELECT conrelid::regclass::text AS table_name, conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE connamespace = $1::regnamespace
        AND conrelid::regclass::text NOT LIKE '%${MIGRATIONS_TABLE}'
      ORDER BY table_name, conname`),
  };
}

describe('Migrations', () => {
  const database = createSequelize({ databaseUrl: TEST_DATABASE_URL, ssl: false });
  const syncedSchema = `test_sync_${crypto.randomBytes(6).toString('hex')}`;
  let migrated: TestApp;

  beforeAll(async () => {
    migrated = await startTestApp();
    await database.query(`CREATE SCHEMA "${syncedSchema}"`);
    const config = buildAppConfig(testEnvironment, { schema: syncedSchema, rateLimit: 'off' });
    const synced = await createCore({ ...config, syncMode: 'create', migrations: [] });
    await synced.close();
  });

  afterAll(async () => {
    await migrated?.close();
    await database.query(`DROP SCHEMA IF EXISTS "${syncedSchema}" CASCADE`);
    await database.close();
  });

  it('build the schema the models describe', async () => {
    expect(await describeSchema(database, migrated.schema)).toEqual(
      await describeSchema(database, syncedSchema)
    );
  });

  it('change nothing on a database sync() created, and are recorded as applied', async () => {
    const config = buildAppConfig(testEnvironment, { schema: syncedSchema, rateLimit: 'off' });
    const before = await describeSchema(database, syncedSchema);

    const core = await createCore(config);
    await core.close();

    expect(await describeSchema(database, syncedSchema)).toEqual(before);
    const [applied] = await database.query(
      `SELECT name FROM "${syncedSchema}"."${MIGRATIONS_TABLE}" ORDER BY name`
    );
    expect(applied).toEqual(config.migrations?.map(({ name }) => ({ name })));
  });
});
