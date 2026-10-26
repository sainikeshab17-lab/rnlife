export interface InventoryRowForAvailability {
  size: string;
  stock: number;
  reserved: number;
}

export interface SizeAvailability {
  size: string;
  available: number | null;
  status: "in_stock" | "low_stock" | "sold_out" | "unconfigured";
}

/** Missing rows are unknown/unconfigured, never fabricated as available or reported as sold out. */
export function calculateSizeAvailability(
  sizes: readonly string[],
  rows: readonly InventoryRowForAvailability[],
): SizeAvailability[] {
  const bySize = new Map(rows.map((row) => [row.size, row]));
  if (bySize.size !== rows.length) throw new Error("Inventory contains duplicate size rows.");
  return sizes.map((size) => {
    const row = bySize.get(size);
    if (!row) return { size, available: null, status: "unconfigured" };
    if (!Number.isSafeInteger(row.stock) || row.stock < 0 || !Number.isSafeInteger(row.reserved) || row.reserved < 0) {
      throw new Error("Inventory contains invalid stock values.");
    }
    const available = Math.max(0, row.stock - row.reserved);
    return {
      size,
      available,
      status: available === 0 ? "sold_out" : available <= 5 ? "low_stock" : "in_stock",
    };
  });
}
