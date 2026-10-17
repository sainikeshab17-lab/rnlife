import { after, test } from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const nonProductionApproved = process.env.TEST_DATABASE_IS_NON_PRODUCTION === "1";
const schemaReady = process.env.TEST_DATABASE_SCHEMA_READY === "1";
const hasAnyTestDatabaseConfig = Boolean(
  testDatabaseUrl || process.env.TEST_DATABASE_IS_NON_PRODUCTION || process.env.TEST_DATABASE_SCHEMA_READY
);

let approvedTestDatabaseUrl;
if (hasAnyTestDatabaseConfig) {
  if (!testDatabaseUrl || !nonProductionApproved || !schemaReady) {
    throw new Error(
      "Test database configuration is incomplete; set TEST_DATABASE_URL, TEST_DATABASE_IS_NON_PRODUCTION=1, and TEST_DATABASE_SCHEMA_READY=1."
    );
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(testDatabaseUrl);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid local PostgreSQL URL.");
  }

  if (
    !["postgres:", "postgresql:"].includes(parsedUrl.protocol) ||
    !["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname)
  ) {
    throw new Error("Database integration tests only permit a loopback PostgreSQL host.");
  }

  approvedTestDatabaseUrl = testDatabaseUrl;
}

export function databaseTest(name, callback) {
  test(name, {
    skip: approvedTestDatabaseUrl
      ? false
      : "requires an explicitly configured loopback TEST_DATABASE_URL, non-production approval, and a ready schema",
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
