import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb, DbNotificationJob } from "@/lib/db/index";
import { processNotificationJob } from "@/services/notification-service";
import { writeAuditLog } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/notifications
 * List transactional notification queue and logs.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const jobs = await db
    .prepare("SELECT * FROM notification_jobs ORDER BY created_at DESC LIMIT 100")
    .all() as DbNotificationJob[];

  return NextResponse.json({ jobs });
}

/**
 * POST /api/admin/notifications
 * Retry a failed or pending notification job.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { jobId } = body;

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId." }, { status: 400 });
  }

  const result = await processNotificationJob(jobId, { manualRetry: true });

  await writeAuditLog({
    actor: admin.email,
    action: "notification_retry",
    entityType: "notification_job",
    entityId: jobId,
    metadata: result,
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({
    success: true,
    providerAccepted: result.sent,
    deliveryConfirmed: false,
    result,
  });
}
