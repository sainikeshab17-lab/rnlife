import { randomBytes } from "crypto";
import { getDb, DbAuditLog } from "@/lib/db/index";

export function writeAuditLog(params: {
  actor: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  ipAddress?: string | null;
}): void {
  try {
    const db = getDb();
    const id = `alog_${randomBytes(8).toString("hex")}`;
    db.prepare(`
      INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, before_value, after_value, metadata, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.actor,
      params.action,
      params.entityType,
      params.entityId ?? null,
      params.before != null ? JSON.stringify(params.before) : null,
      params.after != null ? JSON.stringify(params.after) : null,
      params.metadata != null ? JSON.stringify(params.metadata) : null,
      params.ipAddress ?? null,
      new Date().toISOString()
    );
  } catch (err) {
    console.error("[audit_log] failed to write:", err);
  }
}

export function getAuditLogs(params: {
  entityType?: string;
  entityId?: string;
  actor?: string;
  limit?: number;
  offset?: number;
}): { logs: DbAuditLog[]; total: number } {
  const db = getDb();
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (params.entityType) {
    conditions.push("entity_type = ?");
    args.push(params.entityType);
  }
  if (params.entityId) {
    conditions.push("entity_id = ?");
    args.push(params.entityId);
  }
  if (params.actor) {
    conditions.push("actor = ?");
    args.push(params.actor);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  const total = (db.prepare(`SELECT COUNT(*) as count FROM audit_logs ${where}`).get(...args) as { count: number }).count;
  const logs = db.prepare(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...args, limit, offset) as DbAuditLog[];

  return { logs, total };
}
