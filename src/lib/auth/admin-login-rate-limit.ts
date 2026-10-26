import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { getDb, withTransaction, type DbConnection } from "@/lib/db/index";

const WINDOW_MINUTES = 15;
const DEFAULT_EMAIL_ATTEMPT_LIMIT = 10;
const DEFAULT_IP_ATTEMPT_LIMIT = 300;
export const ADMIN_LOGIN_DEV_IP_HEADER = "x-rightnowlife-dev-client-ip";
const ADMIN_LOGIN_DEV_IP = "127.0.0.1";

type HeadersReader = Pick<Headers, "get">;

export type AdminLoginAttempt =
  | { allowed: false; retryAfterSeconds: number }
  | { allowed: true; complete: () => Promise<void> };

export interface AdminLoginRateLimitDependencies {
  secret: string;
  limits?: { emailAttemptLimit: number; ipAttemptLimit: number; windowMinutes: number };
  transaction<T>(callback: (db: DbConnection) => Promise<T>): Promise<T>;
}

function configuredInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

export function getAdminLoginRateLimitConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    windowMinutes: configuredInteger(env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_MINUTES, WINDOW_MINUTES, 1, 60),
    emailAttemptLimit: configuredInteger(env.ADMIN_LOGIN_EMAIL_ATTEMPT_LIMIT, DEFAULT_EMAIL_ATTEMPT_LIMIT, 5, 50),
    ipAttemptLimit: configuredInteger(env.ADMIN_LOGIN_IP_ATTEMPT_LIMIT, DEFAULT_IP_ATTEMPT_LIMIT, 60, 10_000),
  };
}

export class AdminLoginRateLimitError extends Error {
  constructor(
    readonly kind: "configuration" | "missing_migration" | "database",
    readonly databaseCode?: string,
  ) {
    super("Admin login rate limiting is unavailable.");
    this.name = "AdminLoginRateLimitError";
  }
}

export function getAdminLoginRateLimitDiagnostic(error: unknown): string {
  if (error instanceof AdminLoginRateLimitError) {
    if (error.kind === "configuration") {
      return "ADMIN_SESSION_SECRET must be configured with at least 32 characters for admin login rate limiting.";
    }
    if (error.kind === "missing_migration") {
      return "The admin login rate-limit table is missing (PostgreSQL 42P01); apply migration 20261024150000_admin_login_rate_limits.sql to the runtime database used by DATABASE_URL.";
    }
    if (error.databaseCode === "DATABASE_URL_MISSING") {
      return "DATABASE_URL is not configured for the runtime PostgreSQL connection.";
    }
    return `PostgreSQL rate-limit storage is unavailable (database code ${error.databaseCode ?? "unknown"}).`;
  }
  return "PostgreSQL rate-limit storage is unavailable (database code unknown).";
}

/**
 * Set by this app's Next proxy only in local development. The npm dev script
 * binds Next to loopback, so all reachable requests share the local bucket.
 * The proxy overwrites any browser-supplied copy before forwarding the request.
 */
export function getAdminLoginProxyHeaders(
  headers: Headers,
  pathname: string,
  nodeEnv = process.env.NODE_ENV,
  hostname?: string,
): Headers {
  const forwarded = new Headers(headers);
  const localHost = hostname?.toLowerCase();
  if (nodeEnv === "development" && pathname === "/api/admin/login" &&
      ["localhost", "127.0.0.1", "[::1]", "::1"].includes(localHost ?? "")) {
    forwarded.set(ADMIN_LOGIN_DEV_IP_HEADER, ADMIN_LOGIN_DEV_IP);
  }
  return forwarded;
}

export type AdminLoginClientIpResolution =
  | { clientIp: string; source: "development_proxy" | "trusted_ingress" | "vercel_platform" }
  | { clientIp: null; reason: "development_proxy_missing" | "header_invalid" | "header_value_invalid" | "ip_unavailable" };

export function resolveTrustedAdminLoginClientIp(
  headers: HeadersReader,
  configuredHeader = process.env.ADMIN_LOGIN_TRUSTED_IP_HEADER,
  nodeEnv = process.env.NODE_ENV,
  platform = process.env.VERCEL,
): AdminLoginClientIpResolution {
  if (nodeEnv === "development") {
    const developmentIp = headers.get(ADMIN_LOGIN_DEV_IP_HEADER);
    return developmentIp && developmentIp === developmentIp.trim() && !developmentIp.includes(",") && isIP(developmentIp) !== 0
      ? { clientIp: developmentIp, source: "development_proxy" }
      : { clientIp: null, reason: "development_proxy_missing" };
  }

  // A configured custom header is trusted only when the deployment ingress is
  // explicitly set up to strip and overwrite it. Vercel provides its own
  // system header and overwrites X-Forwarded-For at the platform boundary.
  const vercelPlatformHeader = platform === "1" && !configuredHeader?.trim();
  if (!configuredHeader?.trim() && !vercelPlatformHeader) return { clientIp: null, reason: "ip_unavailable" };
  const headerName = vercelPlatformHeader ? "x-vercel-forwarded-for" : configuredHeader!.trim().toLowerCase();
  const source = vercelPlatformHeader ? "vercel_platform" as const : "trusted_ingress" as const;
  if (!/^x-[a-z0-9-]{1,62}$/.test(headerName) || headerName === "x-forwarded-for" || headerName === "x-real-ip") {
    return { clientIp: null, reason: "header_invalid" };
  }

  const value = headers.get(headerName);
  if (!value || value !== value.trim() || value.includes(",") || isIP(value) === 0) {
    return { clientIp: null, reason: "header_value_invalid" };
  }
  return { clientIp: value, source };
}

/**
 * Read only a single-IP header configured to be overwritten by the trusted
 * ingress. Never fall back to client-controlled X-Forwarded-For/X-Real-IP.
 */
export function getTrustedAdminLoginClientIp(
  headers: HeadersReader,
  configuredHeader = process.env.ADMIN_LOGIN_TRUSTED_IP_HEADER,
  nodeEnv = process.env.NODE_ENV,
  platform = process.env.VERCEL,
): string | null {
  return resolveTrustedAdminLoginClientIp(headers, configuredHeader, nodeEnv, platform).clientIp;
}

function wrapStorageError(error: unknown): AdminLoginRateLimitError {
  const databaseCode = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : undefined;
  if (databaseCode === "42P01") return new AdminLoginRateLimitError("missing_migration", databaseCode);
  if (error instanceof Error && error.message === "DATABASE_URL is required for the PostgreSQL runtime.") {
    return new AdminLoginRateLimitError("database", "DATABASE_URL_MISSING");
  }
  return new AdminLoginRateLimitError("database", databaseCode);
}

/**
 * Reserve a shared PostgreSQL attempt slot before password verification.
 * Successful authentication releases its reservation; failed attempts keep
 * theirs. Database/configuration errors are intentionally thrown to the route
 * so it can fail closed with 503 instead of bypassing throttling.
 */
export async function claimAdminLoginAttempt(
  email: string | null,
  clientIp: string | null,
  dependencies: AdminLoginRateLimitDependencies = {
    secret: process.env.ADMIN_SESSION_SECRET ?? "",
    transaction: withTransaction,
  },
): Promise<AdminLoginAttempt> {
  if (clientIp !== null && isIP(clientIp) === 0) throw new Error("A trusted client IP is required for IP-based admin login throttling.");
  if (email !== null && (email.length > 254 || !email.trim())) {
    throw new Error("A bounded email identity is required for admin login throttling.");
  }
  if (dependencies.secret.length < 32) {
    throw new AdminLoginRateLimitError("configuration");
  }

  const limits = dependencies.limits ?? getAdminLoginRateLimitConfig();
  // Every request gets an email identity bucket, including malformed requests.
  // Missing email uses a separate malformed-input bucket; it is never treated
  // as an admin identity. Without a trusted IP, only this email bucket applies.
  const identities = [
    ...(clientIp ? [{ kind: "ip", value: clientIp, limit: limits.ipAttemptLimit }] : []),
    { kind: "email", value: email?.trim().toLowerCase() || "__missing_email__", limit: limits.emailAttemptLimit },
  ];
  const buckets = identities
    .map(({ kind, value, limit }) => ({
      kind,
      hash: createHmac("sha256", dependencies.secret)
        .update(`rightnowlife:admin-login:v1:${kind}:${value}`)
        .digest("hex"),
      limit,
    }))

  let result: number;
  try {
    result = await dependencies.transaction(async (db) => {
    // Opportunistic bounded retention for old identities. The indexed cleanup
    // prevents one-off source IPs and email addresses accumulating forever.
    await db.prepare("DELETE FROM admin_login_rate_limits WHERE updated_at < NOW() - INTERVAL '1 day'").run();

    let retryAfterSeconds = 0;
    for (const bucket of buckets) {
      const row = await db.prepare(`
        INSERT INTO admin_login_rate_limits (bucket_hash, window_started_at, attempt_count, blocked_until, updated_at)
        VALUES (?, NOW(), 1, NULL, NOW())
        ON CONFLICT (bucket_hash) DO UPDATE SET
          attempt_count = CASE
            WHEN admin_login_rate_limits.blocked_until > NOW() THEN admin_login_rate_limits.attempt_count
            WHEN admin_login_rate_limits.window_started_at <= NOW() - make_interval(mins => ?) THEN 1
            ELSE admin_login_rate_limits.attempt_count + 1
          END,
          window_started_at = CASE
            WHEN admin_login_rate_limits.blocked_until > NOW() THEN admin_login_rate_limits.window_started_at
            WHEN admin_login_rate_limits.window_started_at <= NOW() - make_interval(mins => ?) THEN NOW()
            ELSE admin_login_rate_limits.window_started_at
          END,
          blocked_until = CASE
            WHEN admin_login_rate_limits.blocked_until > NOW() THEN admin_login_rate_limits.blocked_until
            WHEN admin_login_rate_limits.window_started_at <= NOW() - make_interval(mins => ?) THEN NULL
            WHEN admin_login_rate_limits.attempt_count + 1 >= ? THEN NOW() + make_interval(mins => ?)
            ELSE NULL
          END,
          updated_at = NOW()
        RETURNING
          COALESCE(blocked_until > NOW(), FALSE) AS blocked,
          CASE WHEN blocked_until > NOW()
            THEN GREATEST(1, CEIL(EXTRACT(EPOCH FROM (blocked_until - NOW())))::integer)
            ELSE 0
          END AS retry_after_seconds
      `).get<{ blocked: boolean; retry_after_seconds: number }>(
        bucket.hash,
        limits.windowMinutes,
        limits.windowMinutes,
        limits.windowMinutes,
        bucket.limit,
        limits.windowMinutes,
      );

      if (!row) throw new Error("Admin login rate limiter did not return a bucket state.");
      if (row.blocked) {
        retryAfterSeconds = Number(row.retry_after_seconds) || WINDOW_MINUTES * 60;
        break;
      }
    }
      return retryAfterSeconds;
    });
  } catch (error) {
    throw wrapStorageError(error);
  }

  if (result > 0) return { allowed: false, retryAfterSeconds: result };

  return {
    allowed: true,
    complete: async () => {
      try {
        await dependencies.transaction(async (db) => {
          for (const bucket of buckets) {
          if (bucket.kind === "email") {
            // A valid credential proves this account's reserved request was
            // not a failed login. Reset only its account bucket, never the
            // shared IP bucket which may include other actors.
            await db.prepare(`
              UPDATE admin_login_rate_limits
              SET attempt_count = 0, blocked_until = NULL,
                  window_started_at = NOW(), updated_at = NOW()
              WHERE bucket_hash = ?
            `).run(bucket.hash);
          } else {
            await db.prepare(`
              UPDATE admin_login_rate_limits
              SET attempt_count = GREATEST(attempt_count - 1, 0), updated_at = NOW()
              WHERE bucket_hash = ?
            `).run(bucket.hash);
          }
          }
        });
      } catch (error) {
        throw wrapStorageError(error);
      }
    },
  };
}
