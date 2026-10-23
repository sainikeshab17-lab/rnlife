import { NextResponse, type NextRequest } from "next/server";
import type { DbAdminUser, DbConnection, DbNotificationJob } from "@/lib/db";
import type { EmailSendResult } from "@/services/notification-service";

export interface AdminNotificationRouteDependencies {
  requireAdminAuth: (req: NextRequest) => Promise<DbAdminUser | null>;
  getDb: () => DbConnection;
  processNotificationJob: (jobId: string, options: { manualRetry: boolean }) => Promise<EmailSendResult>;
  writeAuditLog: (params: {
    actor: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: unknown;
    ipAddress?: string | null;
  }) => Promise<void>;
}

export function createAdminNotificationHandlers(deps: AdminNotificationRouteDependencies) {
  return {
    async GET(req: NextRequest) {
      const admin = await deps.requireAdminAuth(req);
      if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      try {
        const jobs = await deps.getDb()
          .prepare("SELECT * FROM notification_jobs ORDER BY created_at DESC LIMIT 100")
          .all() as DbNotificationJob[];
        return NextResponse.json({ jobs });
      } catch (error) {
        console.error("[admin/notifications GET] Failed to load notification jobs.", error);
        return NextResponse.json({ error: "Unable to load notification jobs." }, { status: 500 });
      }
    },

    async POST(req: NextRequest) {
      const admin = await deps.requireAdminAuth(req);
      if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const body = await req.json().catch(() => null) as { jobId?: unknown } | null;
      const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
      if (!jobId || jobId.length > 100) return NextResponse.json({ error: "Provide a valid notification job id." }, { status: 400 });

      try {
        const result = await deps.processNotificationJob(jobId, { manualRetry: true });
        if (!result.sent && result.error === "Notification job not found.") {
          return NextResponse.json({ error: result.error }, { status: 404 });
        }

        await deps.writeAuditLog({
          actor: admin.email,
          action: "notification_retry",
          entityType: "notification_job",
          entityId: jobId,
          metadata: { sent: result.sent, provider: result.provider, messageId: result.messageId },
          ipAddress: req.headers.get("x-forwarded-for"),
        });

        return NextResponse.json({
          success: true,
          providerAccepted: result.sent && !result.alreadySent,
          alreadySent: result.alreadySent === true,
          deliveryConfirmed: false,
          result,
          message: result.alreadySent
            ? "This notification was already accepted previously; no duplicate was sent."
            : result.sent
              ? "The provider accepted the email request; delivery is not confirmed."
              : "The notification was not sent. Review its status before retrying.",
        });
      } catch (error) {
        console.error("[admin/notifications POST] Retry processing failed.", {
          jobId,
          reason: error instanceof Error ? error.name : "unknown_error",
        });
        return NextResponse.json({ error: "Notification retry could not be completed. Refresh the job and retry if appropriate." }, { status: 500 });
      }
    },
  };
}
