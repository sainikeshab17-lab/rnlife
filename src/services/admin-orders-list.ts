import type { DbConnection } from "@/lib/db";

export interface AdminOrdersListFilters {
  query: string;
  status: string;
  paymentStatus: string;
  fromDate: string;
  toDate: string;
  page: number;
  limit: number;
}

export interface AdminOrderListItem {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  payment_method: string | null;
  payment_status: string | null;
  order_status: string;
  razorpay_payment_id: string | null;
  courier_name: string | null;
  tracking_number: string | null;
  refund_status: string | null;
}

export interface AdminOrdersListResult {
  orders: AdminOrderListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

function isMissingConfirmationColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; column?: unknown; message?: unknown };
  return candidate.code === "42703" && (
    candidate.column === "is_confirmed" ||
    (typeof candidate.message === "string" && /column ["']?is_confirmed["']? does not exist/i.test(candidate.message))
  );
}

export async function listAdminOrders(
  db: DbConnection,
  filters: AdminOrdersListFilters
): Promise<AdminOrdersListResult> {
  const conditions: string[] = [];
  const args: (string | number)[] = [];
  if (filters.query) {
    conditions.push("(order_number ILIKE ? OR customer_name ILIKE ? OR customer_email ILIKE ? OR tracking_number ILIKE ?)");
    const like = `%${filters.query}%`;
    args.push(like, like, like, like);
  }
  if (filters.status) { conditions.push("order_status = ?"); args.push(filters.status); }
  if (filters.paymentStatus) { conditions.push("payment_status = ?"); args.push(filters.paymentStatus); }
  if (filters.fromDate) { conditions.push("created_at::date >= ?::date"); args.push(filters.fromDate); }
  if (filters.toDate) { conditions.push("created_at::date <= ?::date"); args.push(filters.toDate); }
  const businessFilter = "(payment_status NOT IN ('pending_payment', 'pending_advance') OR payment_method IN ('COD', 'Cash on Delivery'))";

  const query = async (withConfirmationFlag: boolean): Promise<AdminOrdersListResult> => {
    const whereConditions = [...(withConfirmationFlag ? ["is_confirmed = TRUE"] : []), businessFilter, ...conditions];
    const where = `WHERE ${whereConditions.join(" AND ")}`;
    const totalRow = await db.prepare(`SELECT COUNT(*) AS count FROM orders ${where}`)
      .get<{ count: string | number }>(...args);
    const total = Number(totalRow?.count ?? 0);
    const orders = await db.prepare(`SELECT id, order_number, created_at,
        customer_name, customer_email, customer_phone, subtotal, shipping, discount, total,
        payment_method, payment_status, order_status, razorpay_payment_id,
        courier_name, tracking_number, refund_status
      FROM orders ${where}
      ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all<AdminOrderListItem>(...args, filters.limit, (filters.page - 1) * filters.limit);

    return { orders, total, page: filters.page, limit: filters.limit, pages: Math.ceil(total / filters.limit) };
  };

  try {
    return await query(true);
  } catch (error) {
    // The confirmation flag is a later additive migration. During a rolling
    // deployment, keep the legacy schema usable with the same unpaid-online
    // exclusion rather than failing the entire admin list.
    if (!isMissingConfirmationColumn(error)) throw error;
    console.warn("[admin/orders GET] orders.is_confirmed is absent; using the legacy payment-status filter until migrations are applied.");
    return query(false);
  }
}

export function isValidOrderListDate(value: string): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
