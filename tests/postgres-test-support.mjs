import { after, test } from "node:test";
import { validateTestDatabaseConfig } from "./postgres-test-database-gate.mjs";

const testDatabaseConfig = validateTestDatabaseConfig(process.env);
const approvedTestDatabaseUrl = testDatabaseConfig.url;

export function databaseTest(name, callback) {
  test(name, {
    skip: approvedTestDatabaseUrl
      ? false
      : "requires an explicitly approved loopback PostgreSQL database with a test-only database name",
  }, async (...args) => {
    if (!approvedTestDatabaseUrl) return;

    const priorDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = approvedTestDatabaseUrl;
    try {
      await callback(...args);
    } finally {
      if (priorDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = priorDatabaseUrl;
      }
    }
  });
}

after(async () => {
  const pool = globalThis.rightnowlifePostgresPool;
  if (pool) {
    await pool.end();
    globalThis.rightnowlifePostgresPool = undefined;
  }
});
