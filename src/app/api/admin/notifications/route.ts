import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb } from "@/lib/db/index";
import { processNotificationJob } from "@/services/notification-service";
import { writeAuditLog } from "@/lib/db/audit";
import { createAdminNotificationHandlers } from "@/services/admin-notification-route";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/notifications
 * List transactional notification queue and logs.
 */
const handlers = createAdminNotificationHandlers({
  requireAdminAuth,
  getDb,
  processNotificationJob,
  writeAuditLog,
});

export const GET = handlers.GET;

/** POST /api/admin/notifications — retry a failed or pending notification. */
export const POST = handlers.POST;
