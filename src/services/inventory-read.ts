const RETRYABLE_CAPACITY_CODES = new Set([
  "53300", // too_many_connections
]);

export function isTransientDatabaseCapacityError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message : "";
  // Supabase's session pooler can report its capacity limit as XX000. Match
  // that provider-specific message explicitly; XX000 alone is not retryable.
  return RETRYABLE_CAPACITY_CODES.has(code) || /EMAXCONNSESSION|max clients reached in session mode/i.test(message);
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
