import assert from "node:assert/strict";
import test from "node:test";
import { validateTestDatabaseConfig } from "./postgres-test-database-gate.mjs";

const approved = overrides => ({
  TEST_DATABASE_URL: "postgresql://test_user:never-print@localhost:5432/rightnowlife_test",
  TEST_DATABASE_IS_NON_PRODUCTION: "1",
  TEST_DATABASE_SCHEMA_READY: "1",
  ...overrides,
});

test("accepts only explicitly approved test-marker database names", () => {
  for (const name of ["rightnowlife_test", "testing", "ci-test-db"]) {
    const result = validateTestDatabaseConfig(approved({
      TEST_DATABASE_URL: `postgresql://user:pass@localhost:5432/${name}`,
    }));
    assert.equal(result.approved, true);
  }
});

test("rejects ambiguous database names even on loopback", () => {
  for (const name of ["postgres", "rightnowlife", "test-prod-shadow"]) {
    assert.throws(() => validateTestDatabaseConfig(approved({
      TEST_DATABASE_URL: `postgresql://user:pass@localhost:5432/${name}`,
    })));
  }
});

test("rejects production-like names and non-loopback hosts", () => {
  for (const name of ["prod_test", "production-testing", "live-test"]) {
    assert.throws(() => validateTestDatabaseConfig(approved({
      TEST_DATABASE_URL: `postgresql://user:pass@localhost:5432/${name}`,
    })));
  }
  assert.throws(() => validateTestDatabaseConfig(approved({
    TEST_DATABASE_URL: "postgresql://user:pass@db.example.test:5432/rightnowlife_test",
  })));
  for (const suffix of ["?host=db.example.test", "#fragment", "/rightnowlife_test/extra"]) {
    assert.throws(() => validateTestDatabaseConfig(approved({
      TEST_DATABASE_URL: `postgresql://user:pass@localhost:5432/rightnowlife_test${suffix}`,
    })));
  }
});

test("requires each approval and an explicit URL before database use", () => {
  assert.deepEqual(validateTestDatabaseConfig({}), { approved: false, url: null, reason: "not_configured" });
  for (const key of ["TEST_DATABASE_URL", "TEST_DATABASE_IS_NON_PRODUCTION", "TEST_DATABASE_SCHEMA_READY"]) {
    const env = approved({});
    delete env[key];
    assert.throws(() => validateTestDatabaseConfig(env));
  }
});
