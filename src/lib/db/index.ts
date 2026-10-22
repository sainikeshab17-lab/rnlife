import "server-only";
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { types } from "pg";
import { safePostgresDiagnostic, toPostgresPlaceholders } from "./sql";
import type { CustomTShirtCustomization } from "@/types";

types.setTypeParser(1184, (value) => value);

declare global {
  var rightnowlifePostgresPool: Pool | undefined;
}

export interface DbStatement {
  get<T extends QueryResultRow = QueryResultRow>(...params: unknown[]): Promise<T | undefined>;
  all<T extends QueryResultRow = QueryResultRow>(...params: unknown[]): Promise<T[]>;
  run(...params: unknown[]): Promise<QueryResult>;
}

export interface DbConnection {
  prepare(sql: string): DbStatement;
}

class PostgresConnection implements DbConnection {
  constructor(private readonly client: Pool | PoolClient) {}

  private async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[]): Promise<QueryResult<T>> {
    try {
      return await this.client.query<T>(toPostgresPlaceholders(sql), params);
    } catch (error) {
      console.error("[database] Query failed.", JSON.stringify(safePostgresDiagnostic(sql, error)));
      throw error;
    }
  }

  prepare(sql: string): DbStatement {
    return {
      get: async <T extends QueryResultRow = QueryResultRow>(...params: unknown[]): Promise<T | undefined> => {
        const result = await this.query<T>(sql, params);
        return result.rows[0];
      },
      all: async <T extends QueryResultRow>(...params: unknown[]) => {
        const result = await this.query<T>(sql, params);
        return result.rows;
      },
      run: (...params: unknown[]) => this.query(sql, params),
    };
  }
}

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the PostgreSQL runtime.");
  }

  if (!globalThis.rightnowlifePostgresPool) {
    const max = Number.parseInt(process.env.PG_POOL_MAX ?? "10", 10);
    if (!Number.isInteger(max) || max < 1) {
      throw new Error("PG_POOL_MAX must be a positive integer.");
    }
    globalThis.rightnowlifePostgresPool = new Pool({
      connectionString,
      max,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      application_name: "rightnowlife",
    });
    globalThis.rightnowlifePostgresPool.on("error", (error) => {
      console.error(`[database] Unexpected idle PostgreSQL client error (${getErrorCode(error)}).`);
    });
  }

  return globalThis.rightnowlifePostgresPool;
}

function getErrorCode(error: unknown): string {
  return error instanceof Error && "code" in error ? String(error.code) : "unknown";
}

export function getDb(): DbConnection {
  return new PostgresConnection(getPool());
}

export async function withTransaction<T>(
  callback: (db: DbConnection) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(new PostgresConnection(client));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(`[database] Failed to roll back transaction (${getErrorCode(rollbackError)}).`);
    }
    throw error;
  } finally {
    client.release();
  }
}

export interface DbOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  current_payment_attempt_id?: string | null;
  guest_token: string;
  user_id: string | null;
  courier_name: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  dispatch_date: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  cancellation_requested: number | null;
  cancellation_requested_at: string | null;
  cancellation_reason: string | null;
  notes: string | null;
  cancelled_reason: string | null;
  refund_status: string | null;
  refund_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_slug: string;
  product_name: string;
  color: string;
  size: string;
  price: number;
  quantity: number;
  image: string;
  sku: string;
  fit: string;
  fulfillment_type: "stock" | "made_to_order";
  customization: CustomTShirtCustomization | null;
}

export interface DbRazorpayPaymentAttempt {
  id: string;
  order_id: string;
  attempt_number: number;
  attempt_key: string;
  purpose: "full_payment" | "cod_advance";
  receipt: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  creation_state: "pending" | "creating" | "ready" | "unknown" | "retryable";
  payment_state: "not_attempted" | "failed" | "authorized" | "captured" | "cancelled" | "unknown";
  amount_paisa: number;
  currency: string;
  reconciliation_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOrderAddress {
  id: string;
  order_id: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pin_code: string;
  country: string;
}

export interface DbOrderStatusHistory {
  id: string;
  order_id: string;
  from_status: string | null;
  to_status: string;
  actor: string;
  note: string | null;
  created_at: string;
}

export interface DbShippingEvent {
  id: string;
  order_id: string;
  status: string;
  location: string | null;
  description: string;
  courier_name: string | null;
  tracking_number: string | null;
  occurred_at: string;
  created_at: string;
}

export interface DbReturn {
  id: string;
  order_id: string;
  return_number: string;
  customer_email: string;
  type: "return" | "exchange";
  status: string;
  reason: string;
  customer_note: string | null;
  customer_notes: string | null;
  admin_note: string | null;
  admin_notes: string | null;
  resolution_type: string | null;
  refund_amount: number | null;
  inspection_result: string | null;
  inspection_notes: string | null;
  restocked: number;
  exchange_item_id: string | null;
  exchange_size: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbReturnItem {
  id: string;
  return_id: string;
  order_item_id: string;
  product_id: string;
  product_name: string;
  product_slug: string | null;
  color: string;
  size: string;
  quantity: number;
  price: number;
  requested_exchange_size: string | null;
  condition: string | null;
  restocked: number | null;
  created_at: string | null;
}

export interface DbRefundRecord {
  id: string;
  order_id: string;
  return_id: string | null;
  razorpay_refund_id: string | null;
  razorpay_payment_id: string;
  amount: number;
  amount_paisa: number;
  currency: string;
  status: string;
  reason: string | null;
  idempotency_key: string;
  raw_response: string | null;
  initiated_by: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbNotificationJob {
  id: string;
  order_id: string | null;
  event_type: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body_text: string | null;
  body_html: string;
  status: string;
  provider: string;
  provider_message_id: string | null;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export interface OrderWithDetails extends DbOrder {
  items: DbOrderItem[];
  address: DbOrderAddress | null;
  history?: DbOrderStatusHistory[];
  shipping_events?: DbShippingEvent[];
  returns?: (DbReturn & { items: DbReturnItem[] })[];
  refunds?: DbRefundRecord[];
  payment_attempts?: DbRazorpayPaymentAttempt[];
}

export interface DbAdminUser {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface DbInventoryRow {
  product_id: string;
  size: string;
  stock: number;
  reserved: number;
}

export interface DbAuditLog {
  id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_value: string | null;
  after_value: string | null;
  metadata: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface DbProductOverride {
  product_id: string;
  is_active: number;
  custom_description: string | null;
  updated_by: string | null;
  updated_at: string;
}
