import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { ShiprocketError } from "@/lib/shiprocket/client";
import { prepareShiprocketShipment } from "@/services/shiprocket/shipment-preparation";

type Dependencies = {
  requireAdminAuth: typeof requireAdminAuth;
  prepare: typeof prepareShiprocketShipment;
};
const runtimeDependencies = (): Dependencies => ({ requireAdminAuth, prepare: prepareShiprocketShipment });

/** Admin-only, read-only eligibility check; independent of the lifecycle enable flag. */
export function createShipmentPreparationPost(deps: Dependencies = runtimeDependencies()) {
  return async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await deps.requireAdminAuth(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    try {
      const result = await deps.prepare(id);
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const status = error instanceof ShiprocketError ? error.status ?? 502 : 502;
      const message = error instanceof ShiprocketError ? error.message : "Shipment eligibility could not be verified.";
      return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
    }
  };
}
