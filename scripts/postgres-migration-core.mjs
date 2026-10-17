export async function applyVersionedMigrations(client, migrations) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS rightnowlife_schema_migrations (
      migration_id TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const { id, checksum, sql } of migrations) {
    const prior = await client.query(
      "SELECT checksum FROM rightnowlife_schema_migrations WHERE migration_id = $1",
      [id]
    );
    if (prior.rowCount) {
      if (prior.rows[0].checksum !== checksum) {
        throw new Error(`Applied migration ${id} has changed; migrations are forward-only.`);
      }
      console.log(`[skip] ${id} is already applied.`);
      continue;
    }

    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO rightnowlife_schema_migrations (migration_id, checksum) VALUES ($1, $2)",
        [id, checksum]
      );
      await client.query("COMMIT");
      console.log(`[applied] ${id}`);
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        throw new Error(`Migration ${id} failed and rollback could not be confirmed.`);
      }
      throw error;
    }
  }
}
