import { createHash } from "node:crypto";

export const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;

function stableValue(value, normalizeTimestamps = false) {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `base64:${value.toString("base64")}`;
  if (
    normalizeTimestamps &&
    typeof value === "string" &&
    /^\d{4}-\d\d-\d\d[T ]/.test(value)
  ) {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) return date.toISOString();
  }
  return value;
}

function tableRows(db, table, columns, key) {
  const orderBy = key.length
    ? key.map(quoteIdentifier).join(", ")
    : "rowid";
  return db.prepare(
    `SELECT ${columns.map(quoteIdentifier).join(", ")} FROM ${quoteIdentifier(table)} ORDER BY ${orderBy}`
  ).all();
}

function hashRows(rows, columns, key, normalizeTimestamps = false) {
  const normalized = rows.map((row) =>
    Object.fromEntries(columns.map((column) => [
      column,
      stableValue(row[column] ?? null, normalizeTimestamps),
    ]))
  );
  normalized.sort((left, right) => {
    const leftKey = JSON.stringify(key.map((column) => left[column]));
    const rightKey = JSON.stringify(key.map((column) => right[column]));
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function sqliteTableNames(db) {
  return db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all().map(({ name }) => name);
}

function sqliteTableFingerprint(db, table) {
  const tableSql = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?"
  ).get(table)?.sql ?? null;
  const columns = db.prepare(
    `PRAGMA table_info(${quoteIdentifier(table)})`
  ).all();
  const schemaObjects = db.prepare(
    "SELECT type, name, sql FROM sqlite_master WHERE tbl_name = ? AND type IN ('index', 'trigger') ORDER BY type, name"
  ).all(table);
  const foreignKeys = db.prepare(
    `PRAGMA foreign_key_list(${quoteIdentifier(table)})`
  ).all();
  const dataColumns = columns.map(({ name }) => name);
  const primaryKey = columns
    .filter(({ pk }) => pk)
    .sort((a, b) => a.pk - b.pk)
    .map(({ name }) => name);
  const rows = tableRows(db, table, dataColumns, primaryKey);
  return {
    schema: JSON.stringify({ tableSql, columns, schemaObjects, foreignKeys }),
    rowCount: rows.length,
    contentHash: hashRows(rows, dataColumns, primaryKey),
  };
}

export function verifySqliteSourceBackup(source, backup, expectedTables) {
  const expected = [...expectedTables].sort();
  const sourceTables = sqliteTableNames(source);
  const backupTables = sqliteTableNames(backup);
  if (JSON.stringify(sourceTables) !== JSON.stringify(expected)) {
    throw new Error("SQLite source has unexpected or missing tables; import schema requires review.");
  }
  if (JSON.stringify(backupTables) !== JSON.stringify(expected)) {
    throw new Error("SQLite backup has unexpected or missing tables.");
  }
  if (source.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") {
    throw new Error("The SQLite source failed its integrity check.");
  }
  if (backup.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") {
    throw new Error("The supplied SQLite backup failed its integrity check.");
  }
  if (source.prepare("PRAGMA foreign_key_check").all().length !== 0) {
    throw new Error("The SQLite source contains foreign-key violations.");
  }
  if (backup.prepare("PRAGMA foreign_key_check").all().length !== 0) {
    throw new Error("The SQLite backup contains foreign-key violations.");
  }

  const sourceCounts = {};
  for (const table of expected) {
    const sourceFingerprint = sqliteTableFingerprint(source, table);
    const backupFingerprint = sqliteTableFingerprint(backup, table);
    if (sourceFingerprint.schema !== backupFingerprint.schema) {
      throw new Error(`SQLite source and backup schema differ for ${table}.`);
    }
    if (
      sourceFingerprint.rowCount !== backupFingerprint.rowCount ||
      sourceFingerprint.contentHash !== backupFingerprint.contentHash
    ) {
      throw new Error(`SQLite source and backup content differ for ${table}.`);
    }
    sourceCounts[table] = sourceFingerprint.rowCount;
  }
  return sourceCounts;
}

export async function withAtomicTransaction(client, operation) {
  await client.query("BEGIN");
  try {
    const result = await operation();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      throw new Error("Import failed and transaction rollback could not be confirmed.");
    }
    throw error;
  }
}

export async function assertEmptyDestination(client, tables) {
  for (const table of tables) {
    const result = await client.query(
      `SELECT COUNT(*) AS count FROM ${quoteIdentifier(table.name)}`
    );
    if (Number(result.rows[0]?.count) !== 0) {
      throw new Error(`Destination table ${table.name} is not empty; import refused.`);
    }
  }
}

export function assertTableReconciled({
  table,
  sourceRows,
  targetRows,
  columns,
  key,
  normalizeTimestamps = true,
}) {
  if (sourceRows.length !== targetRows.length) {
    throw new Error(`Imported row count does not reconcile for ${table}.`);
  }
  const sourceHash = hashRows(sourceRows, columns, key, normalizeTimestamps);
  const targetHash = hashRows(targetRows, columns, key, normalizeTimestamps);
  if (sourceHash !== targetHash) {
    throw new Error(`Imported content hash does not reconcile for ${table}.`);
  }
}

export function duplicateValueCounts(rows, column) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[column];
    if (value != null) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
}
