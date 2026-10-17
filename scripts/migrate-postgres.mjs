import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import pg from "pg";
import { applyVersionedMigrations } from "./postgres-migration-core.mjs";

dotenv.config({ path: ".env.local" });
dotenv.config();

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const LOCK_ID = 824751392410;

if (!process.argv.includes("--confirm-non-production")) {
  throw new Error("Refusing to connect. Re-run only after reviewing the target and adding --confirm-non-production.");
}

const connectionString = process.env.DIRECT_URL;
if (!connectionString) throw new Error("DIRECT_URL is required for schema migrations.");

const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
  application_name: "rightnowlife-migrations",
});
const client = await pool.connect();

try {
  await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
  const files = (await fs.readdir(MIGRATIONS_DIR))
    .filter((file) => /^\d{14}_[a-z0-9_]+\.sql$/i.test(file))
    .sort();

  if (files.length === 0) throw new Error("No versioned SQL migrations were found.");

  const migrations = [];
  for (const file of files) {
    const migrationId = file.slice(0, -4);
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    migrations.push({ id: migrationId, sql, checksum });
  }
  await applyVersionedMigrations(client, migrations);
} catch (error) {
  console.error(`[db:migrate] Migration failed; connection values withheld (database code ${error?.code ?? "unknown"}).`);
  process.exitCode = 1;
} finally {
  try {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]);
  } finally {
    client.release();
    await pool.end();
  }
}
