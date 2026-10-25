import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { ShiprocketError, shiprocketServiceabilityEnabled } from "@/lib/shiprocket/client";
import { checkShiprocketServiceability, type ShiprocketServiceabilityInput } from "@/services/shiprocket/serviceability-service";

type ServiceabilityRouteDependencies = {
  requireAdminAuth: typeof requireAdminAuth;
  enabled: typeof shiprocketServiceabilityEnabled;
  check: typeof checkShiprocketServiceability;
};

const runtimeDependencies = (): ServiceabilityRouteDependencies => ({
  requireAdminAuth,
  enabled: shiprocketServiceabilityEnabled,
  check: checkShiprocketServiceability,
});

export function createShiprocketServiceabilityPost(deps: ServiceabilityRouteDependencies = runtimeDependencies()) {
  return async function POST(request: NextRequest) {
    const admin = await deps.requireAdminAuth(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!deps.enabled()) return NextResponse.json({ error: "Shiprocket serviceability is disabled." }, { status: 503 });

    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const parsed = body as Record<string, unknown>;
    const rawDimensions = parsed.dimensionsCm;
    let dimensionsCm: ShiprocketServiceabilityInput["dimensionsCm"];
    if (rawDimensions !== undefined) {
      if (!rawDimensions || typeof rawDimensions !== "object" || Array.isArray(rawDimensions)) {
        return NextResponse.json({ error: "Package dimensions must include positive length, breadth, and height values in cm." }, { status: 400 });
      }
      const dimensions = rawDimensions as Record<string, unknown>;
      if ([dimensions.length, dimensions.breadth, dimensions.height].some(value => typeof value !== "number" || !Number.isFinite(value) || value <= 0)) {
        return NextResponse.json({ error: "Package dimensions must include positive length, breadth, and height values in cm." }, { status: 400 });
      }
      dimensionsCm = {
        length: dimensions.length as number,
        breadth: dimensions.breadth as number,
        height: dimensions.height as number,
      };
    }
    if (parsed.confirmed !== true || typeof parsed.deliveryPostcode !== "string" || typeof parsed.cod !== "boolean" ||
        (parsed.weightKg !== undefined && (typeof parsed.weightKg !== "number" || !Number.isFinite(parsed.weightKg) || parsed.weightKg <= 0))) {
      return NextResponse.json({ error: "Explicit confirmation, deliveryPostcode, boolean cod, and positive package measurements are required." }, { status: 400 });
    }

    try {
      const result = await deps.check({
        deliveryPostcode: parsed.deliveryPostcode,
        cod: parsed.cod,
        ...(parsed.weightKg === undefined ? {} : { weightKg: parsed.weightKg as number }),
        ...(dimensionsCm ? { dimensionsCm } : {}),
      } satisfies ShiprocketServiceabilityInput);
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const status = error instanceof ShiprocketError ? error.status ?? 502 : 502;
      const message = error instanceof ShiprocketError ? error.message : "Shiprocket serviceability is temporarily unavailable.";
      return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
    }
  };
}
