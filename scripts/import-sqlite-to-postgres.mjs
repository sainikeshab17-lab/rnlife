import dotenv from "dotenv";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import { FOREIGN_KEYS, TABLES } from "./sqlite-import-manifest.mjs";
import {
  assertEmptyDestination,
  assertTableReconciled,
  duplicateValueCounts,
  quoteIdentifier,
  verifySqliteSourceBackup,
  withAtomicTransaction,
} from "./sqlite-import-core.mjs";

dotenv.config({ path: ".env.local" });
dotenv.config();

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

if (!process.argv.includes("--confirm-non-production-target")) {
  throw new Error("Refusing to connect. Confirm the reviewed non-production target explicitly.");
}
if (!process.argv.includes("--schema-reviewed")) {
  throw new Error("Review and apply the target schema migration before importing data.");
}

const sourcePath = path.resolve(option("--source") ?? "data/rightnowlife.db");
const backupPath = option("--backup");
if (!backupPath) throw new Error("Specify the verified SQLite backup with --backup.");
const resolvedBackup = path.resolve(backupPath);
if (sourcePath === resolvedBackup) throw new Error("The source and backup must be separate files.");

const connectionString = process.env.DIRECT_URL;
if (!connectionString) throw new Error("DIRECT_URL is required for data import.");
const source = new DatabaseSync(sourcePath, { readOnly: true });
const backup = new DatabaseSync(resolvedBackup, { readOnly: true });
const report = Object.fromEntries(TABLES.map(({ name }) => [name, {
  source: 0,
  imported: 0,
  skipped: 0,
  failed: 0,
}]));

let pool;
try {
  const sourceCounts = verifySqliteSourceBackup(
    source,
    backup,
    TABLES.map(({ name }) => name)
  );
  for (const table of TABLES) report[table.name].source = sourceCounts[table.name];

  pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
    application_name: "rightnowlife-sqlite-import",
  });
  const client = await pool.connect();
  try {
    await withAtomicTransaction(client, async () => {
      await client.query(
        `LOCK TABLE ${TABLES.map(({ name }) => quoteIdentifier(name)).join(", ")} IN SHARE ROW EXCLUSIVE MODE`
      );

      for (const table of TABLES) {
        const result = await client.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1",
          [table.name]
        );
        const actualColumns = new Set(result.rows.map(({ column_name }) => column_name));
        const missing = table.columns.filter((column) => !actualColumns.has(column));
        if (missing.length) throw new Error(`Target table ${table.name} is missing reviewed columns.`);
      }
      await assertEmptyDestination(client, TABLES);

      const importedRows = new Map();
      for (const table of TABLES) {
        const sourceRows = source.prepare(
          `SELECT * FROM ${quoteIdentifier(table.name)}`
        ).all();
        const rows = sourceRows.map((row) => table.map ? table.map(row) : row);
        importedRows.set(table.name, rows);
        const columnNames = table.columns.map(quoteIdentifier).join(", ");
        const valuesTemplate = table.columns.map((_, index) => `$${index + 1}`).join(", ");

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          const row = rows[rowIndex];
          const values = table.columns.map((column) => row[column] ?? null);
          try {
            await client.query(
              `INSERT INTO ${quoteIdentifier(table.name)} (${columnNames}) VALUES (${valuesTemplate})`,
              values
            );
            report[table.name].imported += 1;
          } catch (error) {
            report[table.name].failed += 1;
            const code = error?.code ?? "unknown";
            throw new Error(
              `Import failed for ${table.name} row ${rowIndex + 1} (database code ${code}).`
            );
          }
        }
      }

      const foreignKeyFailures = [];
      for (const [child, childColumn, parent, parentColumn] of FOREIGN_KEYS) {
        const invalid = await client.query(
          `SELECT COUNT(*) AS count FROM ${quoteIdentifier(child)} c LEFT JOIN ${quoteIdentifier(parent)} p ON p.${quoteIdentifier(parentColumn)} = c.${quoteIdentifier(childColumn)} WHERE c.${quoteIdentifier(childColumn)} IS NOT NULL AND p.${quoteIdentifier(parentColumn)} IS NULL`
        );
        if (Number(invalid.rows[0].count) !== 0) foreignKeyFailures.push(child);
      }
      if (foreignKeyFailures.length) {
        throw new Error(
          `Import rolled back because foreign-key checks failed for: ${[...new Set(foreignKeyFailures)].join(", ")}.`
        );
      }

      for (const table of TABLES) {
        const sourceRows = importedRows.get(table.name);
        const result = await client.query(
          `SELECT ${table.columns.map(quoteIdentifier).join(", ")} FROM ${quoteIdentifier(table.name)}`
        );
        assertTableReconciled({
          table: table.name,
          sourceRows,
          targetRows: result.rows,
          columns: table.columns,
          key: table.key,
        });
        if (table.name === "refund_records") {
          const sourceDuplicates = duplicateValueCounts(sourceRows, "razorpay_refund_id");
          const targetDuplicates = duplicateValueCounts(result.rows, "razorpay_refund_id");
          if (JSON.stringify(sourceDuplicates) !== JSON.stringify(targetDuplicates)) {
            throw new Error("Duplicate Razorpay refund references did not reconcile.");
          }
        }
      }
    });
    console.log(JSON.stringify({ status: "complete", tables: report }, null, 2));
  } finally {
    client.release();
  }
} catch (error) {
  const code = error?.code ?? "unknown";
  const rolledBackReport = Object.fromEntries(
    Object.entries(report).map(([table, counts]) => [table, { ...counts }])
  );
  console.error(JSON.stringify({
    status: "rolled_back",
    error: "Import stopped; no partial import was committed.",
    databaseCode: code,
    tables: rolledBackReport,
  }));
  process.exitCode = 1;
} finally {
  source.close();
  backup.close();
  if (pool) await pool.end();
}
