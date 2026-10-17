import { test } from "node:test";
import assert from "node:assert/strict";
import { toPostgresPlaceholders } from "../src/lib/db/sql.ts";

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

test("does not replace question marks in line or block comments", () => {
  assert.equal(
    toPostgresPlaceholders("SELECT ? -- ?\n/* ? */ WHERE id = ?"),
    "SELECT $1 -- ?\n/* ? */ WHERE id = $2"
  );
});
