import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("data/rightnowlife.db", { readOnly: true });
const tables = db.prepare(
  "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
).all();

try {
  for (const t of tables) {
    const name = t.name.replaceAll('"', '""');
    console.log(`=== TABLE: ${t.name} ===`);
    console.log(t.sql);
    const info = db.prepare(`PRAGMA table_info("${name}")`).all();
    console.log("COLUMNS:");
    for (const c of info) {
      console.log(`  ${c.name}: ${c.type} (pk=${c.pk}, notnull=${c.notnull})`);
    }
    console.log("INDEXES:");
    const indexes = db.prepare(`PRAGMA index_list("${name}")`).all();
    for (const index of indexes) {
      const indexName = index.name.replaceAll('"', '""');
      const columns = db.prepare(`PRAGMA index_info("${indexName}")`).all().map(({ name: column }) => column);
      const definition = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name=?").get(index.name);
      console.log(`  ${index.name}: unique=${index.unique}; columns=${columns.join(",")}; sql=${definition?.sql ?? "implicit"}`);
    }
    console.log("FOREIGN KEYS:");
    for (const key of db.prepare(`PRAGMA foreign_key_list("${name}")`).all()) {
      console.log(`  ${key.from} -> ${key.table}.${key.to} (on delete ${key.on_delete})`);
    }
  }
} finally {
  db.close();
}
