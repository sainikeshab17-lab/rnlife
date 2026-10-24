import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { ShiprocketError, shiprocketEnabled } from "@/lib/shiprocket/client";
import { assignShipmentAwb, createOrResumeShipment, generateShipmentLabel, scheduleShipmentPickup } from "@/services/shiprocket/shipping-service";

export type ShippingRouteDependencies = {
  requireAdminAuth: typeof requireAdminAuth;
  enabled: typeof shiprocketEnabled;
  create: typeof createOrResumeShipment;
  assignAwb: typeof assignShipmentAwb;
  pickup: typeof scheduleShipmentPickup;
  label: typeof generateShipmentLabel;
};

const runtimeDependencies = (): ShippingRouteDependencies => ({
  requireAdminAuth, enabled: shiprocketEnabled, create: createOrResumeShipment,
  assignAwb: assignShipmentAwb, pickup: scheduleShipmentPickup, label: generateShipmentLabel,
});

export function createShippingPost(deps: ShippingRouteDependencies = runtimeDependencies()) {
  return async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await deps.requireAdminAuth(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!deps.enabled()) return NextResponse.json({ error: "Shiprocket shipping is disabled." }, { status: 503 });
    const { id } = await params;
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
    let body: { action?: unknown; confirmed?: unknown };
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
      body = parsed as { action?: unknown; confirmed?: unknown };
    } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
    if (body.confirmed !== true) return NextResponse.json({ error: "Explicit confirmation is required for this provider action." }, { status: 400 });
    if (!["create", "assign_awb", "pickup", "label"].includes(String(body.action))) return NextResponse.json({ error: "Unsupported shipping action." }, { status: 400 });
    try {
      if (body.action === "create") return NextResponse.json({ order: await deps.create(id) });
      if (body.action === "assign_awb") return NextResponse.json({ order: await deps.assignAwb(id) });
      if (body.action === "pickup") return NextResponse.json({ pickup: await deps.pickup(id) });
      return NextResponse.json({ labelUrl: await deps.label(id) });
    } catch (error) {
      const status = error instanceof ShiprocketError ? error.status ?? 502 : 502;
      const message = error instanceof ShiprocketError ? error.message : "Shiprocket operation failed.";
      return NextResponse.json({ error: message }, { status });
    }
  };
}
