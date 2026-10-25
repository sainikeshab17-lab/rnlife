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
const orderConfirmationMigration = await readFile(
  new URL("../supabase/migrations/20261023190000_order_confirmation_visibility.sql", import.meta.url),
  "utf8"
);
const checkoutPaymentAttemptsMigration = await readFile(
  new URL("../supabase/migrations/20261023200000_checkout_payment_attempts.sql", import.meta.url),
  "utf8"
);
const checkoutAttemptExpiryMigration = await readFile(
  new URL("../supabase/migrations/20261023210000_checkout_attempt_reservation_expiry.sql", import.meta.url),
  "utf8"
);
const shiprocketMigration = await readFile(
  new URL("../supabase/migrations/20261024120000_shiprocket_shipping.sql", import.meta.url),
  "utf8"
);
const shiprocketLifecycleConstraintsMigration = await readFile(
  new URL("../supabase/migrations/20261025120000_shiprocket_lifecycle_constraints.sql", import.meta.url),
  "utf8"
);
const refundWebhookInboxMigration = await readFile(
  new URL("../supabase/migrations/20261024130000_razorpay_refund_webhook_inbox.sql", import.meta.url),
  "utf8"
);
const refundWebhookIdentityMigration = await readFile(
  new URL("../supabase/migrations/20261024140000_razorpay_refund_inbox_identity_audit.sql", import.meta.url),
  "utf8"
);
const adminLoginRateLimitsMigration = await readFile(
  new URL("../supabase/migrations/20261024150000_admin_login_rate_limits.sql", import.meta.url),
  "utf8"
);
const checkoutAttemptRuntime = await readFile(new URL("../src/services/checkout-payment-attempts.ts", import.meta.url), "utf8");
const checkoutCreateRoute = await readFile(new URL("../src/app/api/checkout/create-order/route.ts", import.meta.url), "utf8");
const checkoutVerifyRoute = await readFile(new URL("../src/app/api/checkout/verify-payment/route.ts", import.meta.url), "utf8");
const razorpayWebhookRoute = await readFile(new URL("../src/app/api/webhooks/razorpay/route.ts", import.meta.url), "utf8");
const razorpayRefundInboxService = await readFile(new URL("../src/services/razorpay/refund-webhook-inbox.ts", import.meta.url), "utf8");
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
const shiprocketService = await readFile(new URL("../src/services/shiprocket/shipping-service.ts", import.meta.url), "utf8");
const shiprocketAdminRoute = await readFile(new URL("../src/services/shiprocket/shipping-route-handler.ts", import.meta.url), "utf8");

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

test("order confirmation migration is additive and preserves existing data for review", () => {
  assert.match(orderConfirmationMigration, /ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN NOT NULL DEFAULT TRUE/i);
  assert.match(orderConfirmationMigration, /CREATE INDEX IF NOT EXISTS idx_orders_confirmed_created/i);
  assert.doesNotMatch(orderConfirmationMigration, /\b(?:DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN|UPDATE orders)\b/i);
  assert.match(orderRuntime, /is_confirmed = TRUE/);
  assert.match(orderRuntime, /payment_method IN \('COD', 'Cash on Delivery'\)/);
  assert.match(customerOrdersApi, /getOrdersByCustomer/);
});

test("separate checkout-attempt storage is additive and only converts verified attempts", () => {
  assert.match(checkoutPaymentAttemptsMigration, /CREATE TABLE IF NOT EXISTS checkout_payment_attempts/i);
  assert.match(checkoutPaymentAttemptsMigration, /checkout_snapshot JSONB NOT NULL/i);
  assert.match(checkoutPaymentAttemptsMigration, /provider_order_id TEXT UNIQUE/i);
  assert.match(checkoutPaymentAttemptsMigration, /provider_payment_id TEXT UNIQUE/i);
  assert.doesNotMatch(checkoutPaymentAttemptsMigration, /\b(?:DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN|UPDATE orders)\b/i);
  assert.match(prismaSchema, /model CheckoutPaymentAttempt/);
  assert.match(checkoutCreateRoute, /createCheckoutPaymentAttempt/);
  assert.doesNotMatch(checkoutCreateRoute, /createPendingOrder/);
  assert.match(checkoutVerifyRoute, /verifyPaymentSignature/);
  assert.match(checkoutVerifyRoute, /isVerifiedPaymentDetails/);
  assert.match(checkoutVerifyRoute, /convertCapturedCheckoutAttempt/);
  assert.match(checkoutAttemptRuntime, /attempt\.attempt_status !== "captured"/);
  assert.match(checkoutAttemptRuntime, /FOR UPDATE/);
  assert.match(razorpayWebhookRoute, /getCheckoutPaymentAttemptByProviderOrderId/);
  assert.match(razorpayWebhookRoute, /convertCapturedCheckoutAttempt/);
});

test("reservation expiry migration is additive, auditable, and does not clean legacy rows", () => {
  assert.match(checkoutAttemptExpiryMigration, /reservation_state TEXT NOT NULL DEFAULT 'held'/i);
  assert.match(checkoutAttemptExpiryMigration, /reservation_released_at TIMESTAMPTZ/i);
  assert.match(checkoutAttemptExpiryMigration, /'expired'/i);
  assert.match(checkoutAttemptExpiryMigration, /idx_checkout_attempt_expiry_reservation/i);
  assert.doesNotMatch(checkoutAttemptExpiryMigration, /\b(?:DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN|UPDATE orders)\b/i);
  assert.match(prismaSchema, /reservationState\s+String\s+@default\("held"\)/);
  assert.match(checkoutAttemptRuntime, /FOR UPDATE SKIP LOCKED/);
  assert.match(checkoutAttemptRuntime, /reservation_state = 'released'/);
  assert.match(checkoutAttemptRuntime, /captured_checkout_without_held_reservation/);
  assert.match(checkoutAttemptRuntime, /processCheckoutAttemptExpiryBatch/);
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

test("Shiprocket schema migration is additive and records unique provider references", () => {
  assert.match(shiprocketMigration, /ADD COLUMN IF NOT EXISTS shiprocket_order_id BIGINT/);
  assert.match(shiprocketMigration, /ADD COLUMN IF NOT EXISTS shiprocket_shipment_id BIGINT/);
  assert.match(shiprocketMigration, /shiprocket_state TEXT NOT NULL DEFAULT 'not_created'/);
  assert.match(shiprocketMigration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_shiprocket_order_id/);
  assert.match(shiprocketMigration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_shiprocket_shipment_id/);
  assert.doesNotMatch(shiprocketMigration, /\b(?:DROP|DELETE|TRUNCATE)\b/i);
});

test("Shiprocket lifecycle constraints preserve existing rows for audit and guard future writes", () => {
  assert.match(shiprocketLifecycleConstraintsMigration, /orders_shiprocket_state_check/);
  for (const state of ["not_created", "failed", "creating", "unknown", "order_created", "assigning_awb", "awb_unknown", "awb_assigned", "pickup_requesting", "pickup_unknown", "pickup_requested", "generating_label", "label_unknown", "label_ready"]) {
    assert.match(shiprocketLifecycleConstraintsMigration, new RegExp(`'${state}'`));
  }
  assert.match(shiprocketLifecycleConstraintsMigration, /CHECK \(shiprocket_order_id IS NULL OR shiprocket_order_id > 0\) NOT VALID/);
  assert.match(shiprocketLifecycleConstraintsMigration, /CHECK \(shiprocket_shipment_id IS NULL OR shiprocket_shipment_id > 0\) NOT VALID/);
  assert.match(shiprocketLifecycleConstraintsMigration, /pg_constraint/);
  assert.doesNotMatch(shiprocketLifecycleConstraintsMigration, /\b(?:DROP|DELETE|TRUNCATE|UPDATE)\b/i);
});

test("Razorpay refund webhook inbox is durable, idempotent, and additive", () => {
  assert.match(refundWebhookInboxMigration, /CREATE TABLE IF NOT EXISTS razorpay_refund_webhook_inbox/);
  assert.match(refundWebhookInboxMigration, /event_key TEXT PRIMARY KEY/);
  assert.match(refundWebhookInboxMigration, /state IN \('received', 'deferred', 'processed', 'quarantined'\)/);
  assert.doesNotMatch(refundWebhookInboxMigration, /\b(?:DROP TABLE|DELETE FROM|TRUNCATE)\b/i);
  assert.match(razorpayRefundInboxService, /ON CONFLICT DO NOTHING/);
  assert.match(razorpayRefundInboxService, /SELECT \* FROM orders WHERE id = \? FOR UPDATE/);
  assert.match(razorpayRefundInboxService, /targetStatus = deferred \? "pending"/);
  assert.match(razorpayRefundInboxService, /40P01/);
  assert.match(razorpayWebhookRoute, /refund_durably_deferred/);
  assert.match(razorpayWebhookRoute, /receiveRazorpayRefundWebhook/);
});

test("Razorpay inbox identity migration deduplicates provider events and enforces terminal transitions", () => {
  assert.match(refundWebhookIdentityMigration, /ADD COLUMN IF NOT EXISTS provider_event_id TEXT/);
  assert.match(refundWebhookIdentityMigration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_razorpay_refund_inbox_provider_event_id/);
  assert.match(refundWebhookIdentityMigration, /CREATE TABLE IF NOT EXISTS razorpay_refund_webhook_attempts/);
  assert.match(refundWebhookIdentityMigration, /prevent_razorpay_refund_webhook_attempt_mutation/);
  assert.match(refundWebhookIdentityMigration, /OLD\.state = 'received'.*NEW\.state IN \('deferred', 'processed', 'quarantined'\)/s);
  assert.match(refundWebhookIdentityMigration, /OLD\.state = 'deferred'.*NEW\.state IN \('processed', 'quarantined'\)/s);
  assert.match(refundWebhookIdentityMigration, /RAISE EXCEPTION 'Illegal Razorpay refund inbox state transition/);
  assert.doesNotMatch(refundWebhookIdentityMigration, /\b(?:DELETE FROM|TRUNCATE|DROP TABLE)\b/i);
});

test("admin login rate-limit migration stores opaque buckets and denies Supabase client roles", () => {
  assert.match(adminLoginRateLimitsMigration, /CREATE TABLE IF NOT EXISTS admin_login_rate_limits/);
  assert.match(adminLoginRateLimitsMigration, /bucket_hash TEXT PRIMARY KEY CHECK/);
  assert.match(adminLoginRateLimitsMigration, /ALTER TABLE admin_login_rate_limits ENABLE ROW LEVEL SECURITY/);
  assert.match(adminLoginRateLimitsMigration, /REVOKE ALL ON TABLE admin_login_rate_limits FROM anon, authenticated/);
});

test("Shiprocket stays isolated behind server authorization, payment checks, and idempotent claims", () => {
  assert.match(shiprocketService, /import "server-only"/);
  assert.match(shiprocketService, /order\.payment_status !== "paid"/);
  assert.match(shiprocketService, /order\.payment_status !== "paid"/);
  assert.match(shiprocketService, /\["pending_payment", "paid"\]\.includes\(order\.payment_status\)/);
  assert.match(shiprocketService, /refund_pending/);
  assert.match(shiprocketService, /\^\\d\{6\}\$/);
  assert.match(shiprocketService, /tracking_number IS NULL/);
  assert.match(shiprocketService, /export async function assignShipmentAwb/);
  assert.match(shiprocketService, /creating: \["not_created", "failed"\]/);
  assert.match(shiprocketService, /FOR UPDATE/);
  assert.match(shiprocketService, /"unknown"/);
  assert.match(shiprocketService, /"awb_unknown"/);
  assert.match(shiprocketService, /shiprocket_state = 'pickup_requesting'/);
  assert.doesNotMatch(shiprocketService, /order_status\s*=\s*'shipped'/i);
  assert.match(shiprocketAdminRoute, /requireAdminAuth/);
  assert.match(shiprocketAdminRoute, /admin\.role !== "admin"/);
  assert.match(shiprocketAdminRoute, /deps\.enabled\(\)/);
  assert.match(shiprocketAdminRoute, /body\.confirmed !== true/);
  assert.match(shiprocketAdminRoute, /"assign_awb"/);
  assert.match(shiprocketAdminRoute, /Invalid order ID/);
});
