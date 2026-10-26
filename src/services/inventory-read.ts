const RETRYABLE_CAPACITY_CODES = new Set([
  "53300", // too_many_connections
  "57P03", // cannot_connect_now
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
]);

export function isTransientDatabaseCapacityError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message : "";
  return RETRYABLE_CAPACITY_CODES.has(code) || /EMAXCONNSESSION|max clients reached in session mode|too many clients/i.test(message);
}

/** Inventory reads are idempotent; retry a known transient connection-capacity failure once. */
export async function readInventoryWithRetry<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (!isTransientDatabaseCapacityError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 150));
    return read();
  }
}
