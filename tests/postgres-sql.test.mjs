import { test } from "node:test";
import assert from "node:assert/strict";
import { safePostgresDiagnostic, toPostgresPlaceholders } from "../src/lib/db/sql.ts";

test("converts SQLite-style placeholders to ordered PostgreSQL placeholders", () => {
  assert.equal(
    toPostgresPlaceholders("SELECT * FROM orders WHERE id = ? AND status = ?"),
    "SELECT * FROM orders WHERE id = $1 AND status = $2"
  );
});

test("does not replace question marks inside quoted strings or identifiers", () => {
  assert.equal(
    toPostgresPlaceholders(`SELECT '?' AS literal, "?" AS identifier, ? AS value, 'it''s ?' AS escaped`),
    `SELECT '?' AS literal, "?" AS identifier, $1 AS value, 'it''s ?' AS escaped`
  );
});

test("database diagnostics identify missing relations and redact SQL literals", () => {
  const diagnostic = safePostgresDiagnostic(
    "SELECT * FROM orders WHERE customer_email = 'buyer@example.test' AND id = ?",
    Object.assign(new Error('relation "razorpay_payment_attempts" does not exist'), { code: "42P01" })
  );
  assert.equal(diagnostic.code, "42P01");
  assert.equal(diagnostic.missingRelation, "razorpay_payment_attempts");
  assert.equal(diagnostic.statement, "SELECT * FROM orders WHERE customer_email = '[redacted]' AND id = ?");
  assert.doesNotMatch(JSON.stringify(diagnostic), /buyer@example\.test|does not exist/);
});

test("does not replace question marks in line or block comments", () => {
  assert.equal(
    toPostgresPlaceholders("SELECT ? -- ?\n/* ? */ WHERE id = ?"),
    "SELECT $1 -- ?\n/* ? */ WHERE id = $2"
  );
});
