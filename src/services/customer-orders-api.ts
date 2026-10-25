import { safePostgresDiagnostic } from "@/lib/db/sql";

export async function respondWithCustomerOrders(
  loadOrders: () => Promise<unknown[]>,
  reportError: (message: string, diagnostic: ReturnType<typeof safePostgresDiagnostic>) => void = (message, diagnostic) => {
    console.error(message, JSON.stringify(diagnostic));
  }
): Promise<Response> {
  try {
    const orders = await loadOrders();
    const customerOrders = orders.map((order) => {
      if (!order || typeof order !== "object" || Array.isArray(order)) return order;
      const { shiprocket_label_url: _privateLabelUrl, ...customerOrder } = order as Record<string, unknown>;
      return customerOrder;
    });
    return Response.json({ orders: customerOrders });
  } catch (error) {
    reportError("[GET /api/orders] Database query failed.", safePostgresDiagnostic("customer order history query", error));
    return Response.json({ error: "Failed to fetch orders." }, { status: 500 });
  }
}
