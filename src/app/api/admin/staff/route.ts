import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb } from "@/lib/db/index";

export const dynamic = "force-dynamic";

async function authorize(req: NextRequest) {
  const admin = await requireAdminAuth(req);
  if (!admin) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (admin.role !== "admin") return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { admin };
}

// Lists real admin/staff accounts. No demo users are returned.
export async function GET(req: NextRequest) {
  try {
    const auth = await authorize(req);
    if (auth.response) return auth.response;
    const rows = await getDb().prepare(`
      SELECT id, name, email, role, is_active, created_at, updated_at
      FROM admin_users ORDER BY created_at DESC
    `).all<{id:string;name:string;email:string;role:string;is_active:number|boolean;created_at:string;updated_at:string}>();
    return NextResponse.json({ staff: rows.map((r) => ({
      id:r.id, name:r.name, email:r.email, role:r.role,
      status: r.is_active === true || Number(r.is_active) === 1 ? "active" : "inactive",
      created_at:r.created_at, updated_at:r.updated_at,
    })) });
  } catch (error) {
    console.error("[admin/staff GET]", error);
    return NextResponse.json({ error: "Unable to load staff accounts." }, { status: 500 });
  }
}

// Status changes are persisted; an admin cannot deactivate their own active session.
export async function PATCH(req: NextRequest) {
  try {
    const auth = await authorize(req);
    if (auth.response) return auth.response;
    const body = await req.json().catch(() => null);
    if (!body || typeof body.id !== "string" || typeof body.is_active !== "boolean") {
      return NextResponse.json({ error: "Provide a staff id and boolean is_active value." }, { status: 400 });
    }
    if (body.id === auth.admin.id && body.is_active === false) {
      return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
    }
    const result = await getDb().prepare(`
      UPDATE admin_users SET is_active = ?, updated_at = NOW()
      WHERE id = ? RETURNING id, name, email, role, is_active, created_at, updated_at
    `).get<{id:string;name:string;email:string;role:string;is_active:number|boolean;created_at:string;updated_at:string}>(body.is_active ? 1 : 0, body.id);
    if (!result) return NextResponse.json({ error: "Staff account not found." }, { status: 404 });
    return NextResponse.json({ staff: { ...result, status: result.is_active === true || Number(result.is_active) === 1 ? "active" : "inactive" } });
  } catch (error) {
    console.error("[admin/staff PATCH]", error);
    return NextResponse.json({ error: "Unable to update staff account." }, { status: 500 });
  }
}
