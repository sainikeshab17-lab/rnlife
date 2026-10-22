import { safePostgresDiagnostic } from "@/lib/db/sql";

export async function respondWithCustomerOrders(
  loadOrders: () => Promise<unknown[]>,
  reportError: (message: string, diagnostic: ReturnType<typeof safePostgresDiagnostic>) => void = (message, diagnostic) => {
    console.error(message, JSON.stringify(diagnostic));
  }
): Promise<Response> {
  try {
    const orders = await loadOrders();
    return Response.json({ orders });
  } catch (error) {
    reportError("[GET /api/orders] Database query failed.", safePostgresDiagnostic("customer order history query", error));
    return Response.json({ error: "Failed to fetch orders." }, { status: 500 });
  }
}
