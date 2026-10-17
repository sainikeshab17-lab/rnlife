import assert from "node:assert/strict";
import { test } from "node:test";
import { applyVersionedMigrations } from "../scripts/postgres-migration-core.mjs";

class MemoryMigrationClient {
  ledger = new Map();
  tables = new Set();
  transactionSnapshot;
  failNextMigration = true;

  async query(sql, values = []) {
    const statement = sql.trim();
    if (statement.startsWith("CREATE TABLE IF NOT EXISTS rightnowlife_schema_migrations")) {
      return { rowCount: 0, rows: [] };
    }
    if (statement === "BEGIN") {
      this.transactionSnapshot = {
        ledger: new Map(this.ledger),
        tables: new Set(this.tables),
      };
      return { rowCount: 0, rows: [] };
    }
    if (statement === "ROLLBACK") {
      this.ledger = this.transactionSnapshot.ledger;
      this.tables = this.transactionSnapshot.tables;
      this.transactionSnapshot = undefined;
      return { rowCount: 0, rows: [] };
    }
    if (statement === "COMMIT") {
      this.transactionSnapshot = undefined;
      return { rowCount: 0, rows: [] };
    }
    if (statement.startsWith("SELECT checksum FROM rightnowlife_schema_migrations")) {
      const checksum = this.ledger.get(values[0]);
      return {
        rowCount: checksum ? 1 : 0,
        rows: checksum ? [{ checksum }] : [],
      };
    }
    if (statement.startsWith("CREATE TABLE demo")) {
      if (this.failNextMigration) {
        this.failNextMigration = false;
        throw new Error("simulated migration failure");
      }
      this.tables.add("demo");
      return { rowCount: 0, rows: [] };
    }
    if (statement.startsWith("INSERT INTO rightnowlife_schema_migrations")) {
      this.ledger.set(values[0], values[1]);
      return { rowCount: 1, rows: [] };
    }
    throw new Error(`Unexpected test SQL: ${statement}`);
  }
}

test("failed migration leaves no applied ledger row and an unchanged retry succeeds", async () => {
  const client = new MemoryMigrationClient();
  const migration = [{ id: "20261017000000_test", checksum: "sha256", sql: "CREATE TABLE demo (id INT)" }];

  await assert.rejects(applyVersionedMigrations(client, migration), /simulated migration failure/);
  assert.equal(client.ledger.has(migration[0].id), false);
  assert.equal(client.tables.has("demo"), false);

  await applyVersionedMigrations(client, migration);
  assert.equal(client.ledger.get(migration[0].id), "sha256");
  assert.equal(client.tables.has("demo"), true);

  await assert.doesNotReject(applyVersionedMigrations(client, migration));
  assert.equal(client.ledger.size, 1);
});
