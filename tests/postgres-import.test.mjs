import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import {
  assertEmptyDestination,
  assertTableReconciled,
  duplicateValueCounts,
  verifySqliteSourceBackup,
  withAtomicTransaction,
} from "../scripts/sqlite-import-core.mjs";

function createFixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "rightnowlife-import-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const sourcePath = path.join(directory, "source.db");
  const backupPath = path.join(directory, "backup.db");
  return { sourcePath, backupPath };
}

function createDatabase(filePath, rows) {
  const db = new DatabaseSync(filePath);
  db.exec("CREATE TABLE records (id TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const insert = db.prepare("INSERT INTO records (id, value) VALUES (?, ?)");
  for (const row of rows) insert.run(row.id, row.value);
  db.close();
}

test("source and backup preflight compares schema and full table content", (t) => {
  const { sourcePath, backupPath } = createFixture(t);
  const rows = [{ id: "1", value: "same" }, { id: "2", value: "also same" }];
  createDatabase(sourcePath, rows);
  createDatabase(backupPath, rows);
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  const backup = new DatabaseSync(backupPath, { readOnly: true });
  try {
    assert.deepEqual(verifySqliteSourceBackup(source, backup, ["records"]), { records: 2 });
  } finally {
    source.close();
    backup.close();
  }
});

test("source and backup preflight rejects same-count content mismatch", (t) => {
  const { sourcePath, backupPath } = createFixture(t);
  createDatabase(sourcePath, [{ id: "1", value: "original" }]);
  createDatabase(backupPath, [{ id: "1", value: "different" }]);
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  const backup = new DatabaseSync(backupPath, { readOnly: true });
  try {
    assert.throws(
      () => verifySqliteSourceBackup(source, backup, ["records"]),
      /content differ for records/
    );
  } finally {
    source.close();
    backup.close();
  }
});

test("a non-empty destination is refused", async () => {
  const client = {
    async query() {
      return { rows: [{ count: "1" }] };
    },
  };
  await assert.rejects(
    assertEmptyDestination(client, [{ name: "orders" }]),
    /Destination table orders is not empty/
  );
});

test("any import operation failure rolls back and never commits", async () => {
  const statements = [];
  const client = {
    async query(statement) {
      statements.push(statement);
      return { rows: [] };
    },
  };
  await assert.rejects(
    withAtomicTransaction(client, async () => {
      statements.push("INSERT attempted");
      throw new Error("simulated row failure");
    }),
    /simulated row failure/
  );
  assert.deepEqual(statements, ["BEGIN", "INSERT attempted", "ROLLBACK"]);
});

test("post-import reconciliation detects content mismatch and preserves duplicate refund IDs", () => {
  const columns = ["id", "razorpay_refund_id"];
  const key = ["id"];
  const source = [
    { id: "r1", razorpay_refund_id: "shared-provider-id" },
    { id: "r2", razorpay_refund_id: "shared-provider-id" },
    { id: "r3", razorpay_refund_id: null },
  ];
  const target = source.map((row) => ({ ...row }));
  assert.doesNotThrow(() => assertTableReconciled({
    table: "refund_records",
    sourceRows: source,
    targetRows: target,
    columns,
    key,
  }));
  assert.deepEqual(
    duplicateValueCounts(source, "razorpay_refund_id"),
    [["shared-provider-id", 2]]
  );
  target[1].razorpay_refund_id = "different-provider-id";
  assert.throws(
    () => assertTableReconciled({
      table: "refund_records",
      sourceRows: source,
      targetRows: target,
      columns,
      key,
    }),
    /content hash does not reconcile/
  );
});
