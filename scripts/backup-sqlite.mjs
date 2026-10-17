import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync, backup } from "node:sqlite";

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const sourcePath = path.resolve(option("--source") ?? "data/rightnowlife.db");
const outputPath = option("--output");
if (!outputPath) throw new Error("Specify a new backup path with --output.");

const destination = path.resolve(outputPath);
try {
  await fs.access(destination);
  throw new Error("Refusing to overwrite an existing backup.");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

await fs.mkdir(path.dirname(destination), { recursive: true });
const source = new DatabaseSync(sourcePath, { readOnly: true });
const countTables = (db) => {
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all();
  return Object.fromEntries(tables.map(({ name }) => {
    const quoted = `"${name.replaceAll('"', '""')}"`;
    return [name, db.prepare(`SELECT COUNT(*) AS count FROM ${quoted}`).get().count];
  }));
};

try {
  const before = countTables(source);
  await backup(source, destination);
  const copy = new DatabaseSync(destination, { readOnly: true });
  try {
    const integrity = copy.prepare("PRAGMA integrity_check").get().integrity_check;
    const after = countTables(copy);
    if (integrity !== "ok" || JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error("Backup verification failed: integrity or table counts differ.");
    }
    console.log(JSON.stringify({
      backupPath: destination,
      bytes: (await fs.stat(destination)).size,
      integrity,
      tableCounts: after,
    }, null, 2));
  } finally {
    copy.close();
  }
} catch (error) {
  await fs.rm(destination, { force: true });
  throw error;
} finally {
  source.close();
}
