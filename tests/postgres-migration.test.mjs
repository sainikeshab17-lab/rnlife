import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { FOREIGN_KEYS, TABLES } from "../scripts/sqlite-import-manifest.mjs";

const migration = await readFile(
  new URL("../supabase/migrations/20261017000000_supabase_init.sql", import.meta.url),
  "utf8"
);
const checkoutMigration = await readFile(
  new URL("../supabase/migrations/20261021000000_checkout_idempotency.sql", import.meta.url),
  "utf8"
);
const razorpayRecoveryMigration = await readFile(
  new URL("../supabase/migrations/20261021120000_razorpay_order_recovery.sql", import.meta.url),
  "utf8"
);
const razorpayPaymentAttemptsMigration = await readFile(
  new URL("../supabase/migrations/20261021130000_razorpay_payment_attempts.sql", import.meta.url),
  "utf8"
);
const customOrdersAndCodAdvanceMigration = await readFile(
  new URL("../supabase/migrations/20261022120000_custom_orders_and_cod_advance.sql", import.meta.url),
  "utf8"
);
const importer = await readFile(
  new URL("../scripts/import-sqlite-to-postgres.mjs", import.meta.url),
  "utf8"
);
const prismaSchema = await readFile(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8"
);
const runtimeTypes = await readFile(
  new URL("../src/lib/db/index.ts", import.meta.url),
  "utf8"
);
const orderRuntime = await readFile(new URL("../src/lib/db/orders.ts", import.meta.url), "utf8");
const notificationRuntime = await readFile(new URL("../src/services/notification-service.ts", import.meta.url), "utf8");
const customerOrdersPage = await readFile(new URL("../src/app/account/orders/page.tsx", import.meta.url), "utf8");
const customerOrdersApi = await readFile(new URL("../src/app/api/orders/route.ts", import.meta.url), "utf8");

test("the importer manifest covers all 16 target tables and their columns", () => {
  assert.equal(TABLES.length, 16);
  assert.equal(new Set(TABLES.map(({ name }) => name)).size, TABLES.length);

  for (const { name, columns } of TABLES) {
    const tableDefinition = migration.match(
      new RegExp(`CREATE TABLE IF NOT EXISTS ${name} \\(([\\s\\S]*?)\\n\\);`)
    )?.[1];
    assert.ok(tableDefinition, `migration must create ${name}`);
    for (const column of columns) {
      assert.match(tableDefinition, new RegExp(`\\b${column}\\b`), `${name}.${column}`);
    }
  }
});

test("SQLite notification columns map to service columns without conflating return fields", () => {
  const notification = TABLES.find(({ name }) => name === "notification_jobs");
  const row = notification.map({
    id: "job",
    html_content: "<p>test</p>",
    retry_count: 2,
    max_retries: 5,
  });
  assert.equal(row.body_html, "<p>test</p>");
  assert.equal(row.attempts, 2);
  assert.equal(row.max_attempts, 5);
  assert.equal(row.body_text, null);

  const returns = TABLES.find(({ name }) => name === "returns");
  assert.ok(returns.columns.includes("customer_note"));
  assert.ok(returns.columns.includes("customer_notes"));
  assert.ok(returns.columns.includes("admin_note"));
  assert.ok(returns.columns.includes("admin_notes"));
  assert.ok(TABLES.find(({ name }) => name === "return_items").columns.includes("product_name"));
  assert.ok(TABLES.find(({ name }) => name === "refund_records").columns.includes("amount_paisa"));
});

test("migration preserves foreign-key coverage and denies Supabase client roles", () => {
  for (const [child, childColumn, parent, parentColumn] of FOREIGN_KEYS) {
    assert.ok(TABLES.some(({ name }) => name === child));
    assert.match(
      migration,
      new RegExp(`${childColumn} TEXT NOT NULL REFERENCES ${parent}\\(${parentColumn}\\)`)
    );
  }
  for (const { name } of TABLES) {
    assert.match(migration, new RegExp(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY`));
  }
  assert.match(migration, /FROM anon, authenticated/);
});

test("checkout idempotency migration is additive and leaves existing rows intact", () => {
  assert.match(checkoutMigration, /ALTER TABLE orders\s+ADD COLUMN IF NOT EXISTS checkout_idempotency_key TEXT/i);
  assert.match(checkoutMigration, /ADD COLUMN IF NOT EXISTS checkout_request_hash TEXT/i);
  assert.match(checkoutMigration, /CREATE UNIQUE INDEX IF NOT EXISTS .*checkout_idempotency_key/i);
  assert.match(checkoutMigration, /ALTER TABLE notification_jobs\s+ADD COLUMN IF NOT EXISTS provider_first_attempt_at TIMESTAMPTZ/i);
  assert.doesNotMatch(checkoutMigration, /\b(?:DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN)\b/i);
  assert.doesNotMatch(prismaSchema, /checkoutIdempotencyKey|providerFirstAttemptAt/);
  assert.doesNotMatch(runtimeTypes, /checkout_idempotency_key|provider_first_attempt_at/);
  assert.match(orderRuntime, /checkout_idempotency:/);
  assert.doesNotMatch(orderRuntime, /checkout_idempotency_key|checkout_request_hash/);
  assert.doesNotMatch(notificationRuntime, /provider_first_attempt_at/);
});

test("Razorpay order recovery migration is additive and supports legacy orders", () => {
  assert.match(razorpayRecoveryMigration, /ADD COLUMN IF NOT EXISTS razorpay_order_state TEXT/i);
  assert.match(razorpayRecoveryMigration, /ADD COLUMN IF NOT EXISTS razorpay_order_attempted_at TIMESTAMPTZ/i);
  assert.match(razorpayRecoveryMigration, /razorpay_order_state IS NULL OR razorpay_order_state IN/i);
  assert.match(razorpayRecoveryMigration, /CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_recovery/i);
  assert.doesNotMatch(razorpayRecoveryMigration, /\b(?:DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN|UPDATE orders)\b/i);
  assert.doesNotMatch(prismaSchema, /razorpayOrderState|razorpayOrderAttemptedAt/);
  assert.doesNotMatch(runtimeTypes, /razorpay_order_state|razorpay_order_attempted_at/);
  assert.match(orderRuntime, /razorpay_order_creation:creating/);
});

test("payment attempt migration is additive and retains existing Razorpay identities", () => {
  assert.match(razorpayPaymentAttemptsMigration, /CREATE TABLE IF NOT EXISTS razorpay_payment_attempts/i);
  assert.match(razorpayPaymentAttemptsMigration, /UNIQUE \(order_id, attempt_number\)/i);
  assert.match(razorpayPaymentAttemptsMigration, /UNIQUE \(order_id, attempt_key\)/i);
  assert.match(razorpayPaymentAttemptsMigration, /current_payment_attempt_id/i);
  assert.match(razorpayPaymentAttemptsMigration, /WHERE o\.razorpay_order_id IS NOT NULL/i);
  assert.match(prismaSchema, /model RazorpayPaymentAttempt/);
  assert.match(runtimeTypes, /current_payment_attempt_id|DbRazorpayPaymentAttempt/);
  assert.match(orderRuntime, /razorpay_payment_attempts|current_payment_attempt_id/);
  assert.doesNotMatch(razorpayPaymentAttemptsMigration, /\b(?:DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN)\b/i);
});

test("consolidated custom-order and COD Advance migration is additive and preserves historical rows", () => {
  assert.match(customOrdersAndCodAdvanceMigration, /ADD COLUMN IF NOT EXISTS customization JSONB/i);
  assert.match(customOrdersAndCodAdvanceMigration, /fulfillment_type TEXT NOT NULL DEFAULT 'stock'/i);
  assert.match(customOrdersAndCodAdvanceMigration, /CREATE TABLE IF NOT EXISTS razorpay_payment_attempts/i);
  assert.match(customOrdersAndCodAdvanceMigration, /UNIQUE \(order_id, attempt_key\)/i);
  assert.match(customOrdersAndCodAdvanceMigration, /purpose IN \('full_payment', 'cod_advance'\)/i);
  assert.match(customOrdersAndCodAdvanceMigration, /ON DELETE RESTRICT/i);
  assert.doesNotMatch(customOrdersAndCodAdvanceMigration, /\b(?:DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN|UPDATE orders|UPDATE order_items)\b/i);
  assert.match(prismaSchema, /customization Json\? @db\.JsonB/);
  assert.match(prismaSchema, /fulfillmentType String @default\("stock"\)/);
});

test("authenticated order-list UI and API do not expose or link guest tokens", () => {
  assert.doesNotMatch(customerOrdersPage, /guest_token|\?token=/);
  assert.doesNotMatch(customerOrdersApi, /guest_token/);
});

test("SQLite-nullable fields remain nullable with their defaults", () => {
  const nullableColumns = [
    ["orders", "cancellation_requested", "0"],
    ["returns", "resolution_type", "'refund'"],
    ["returns", "refund_amount", "0"],
    ["return_items", "condition", "'pending'"],
    ["return_items", "restocked", "0"],
    ["return_items", "created_at", "NOW()"],
  ];
  for (const [table, column, defaultValue] of nullableColumns) {
    const tableDefinition = migration.match(
      new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\n\\);`)
    )?.[1];
    const declaration = tableDefinition
      ?.split(/\r?\n/)
      .find((line) => new RegExp(`^\\s*${column}\\s`).test(line));
    assert.ok(declaration, `${table}.${column} must be defined`);
    assert.doesNotMatch(declaration, /\bNOT NULL\b/i, `${table}.${column} must stay nullable`);
    assert.match(declaration, new RegExp(`DEFAULT ${defaultValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
  assert.match(prismaSchema, /cancellationRequested\s+Int\?/);
  assert.match(prismaSchema, /resolutionType\s+String\?/);
  assert.match(prismaSchema, /refundAmount\s+Int\?/);
  assert.match(prismaSchema, /condition\s+String\?/);
  assert.match(prismaSchema, /restocked\s+Int\?/);
  assert.match(prismaSchema, /createdAt\s+DateTime\?/);
  assert.match(runtimeTypes, /cancellation_requested: number \| null/);
  assert.match(runtimeTypes, /resolution_type: string \| null/);
  assert.match(runtimeTypes, /refund_amount: number \| null/);
  assert.match(runtimeTypes, /condition: string \| null/);
  assert.match(runtimeTypes, /restocked: number \| null/);
  assert.match(runtimeTypes, /created_at: string \| null/);
});

test("import is non-destructive, locks an empty destination, and reconciles before commit", () => {
  assert.equal(/\b(?:DELETE FROM|TRUNCATE)\b/i.test(importer), false);
  assert.match(importer, /withAtomicTransaction\(client/);
  assert.match(importer, /LOCK TABLE[\s\S]*SHARE ROW EXCLUSIVE MODE/);
  assert.match(importer, /assertEmptyDestination\(client, TABLES\)/);
  assert.match(importer, /assertTableReconciled/);
  assert.match(importer, /duplicateValueCounts\(sourceRows, "razorpay_refund_id"\)/);
  assert.doesNotMatch(importer, /ON CONFLICT/i);
  assert.match(importer, /await client\.query\(\s*`INSERT INTO/);
  assert.match(importer, /status: "rolled_back"/);
});
