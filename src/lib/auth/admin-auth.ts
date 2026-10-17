/**
 * Admin Authentication Library
 *
 * Uses:
 * - PBKDF2-SHA512 (100,000 rounds) for password hashing via Node built-in crypto
 * - Cryptographically random 256-bit session tokens stored as HMAC-SHA256 hash in DB
 * - HTTP-only, SameSite=Strict, Secure cookies
 * - Constant-time comparison for all secret comparisons
 * - No external dependencies (bcrypt, argon2, etc.)
 */

import { randomBytes, pbkdf2Sync, timingSafeEqual, createHmac } from "crypto";
import { getDb, DbAdminUser, withTransaction } from "@/lib/db/index";
import { NextRequest } from "next/server";

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = "sha512";
const SESSION_BYTES = 32; // 256-bit token
const SESSION_TTL_HOURS = 24;
export const ADMIN_COOKIE_NAME = "rnl_admin_session";

// ─── Password Hashing ────────────────────────────────────────────────────────

/**
 * Hash a password with PBKDF2-SHA512.
 * Returns a string: "pbkdf2$<iterations>$<salt_hex>$<hash_hex>"
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${hash.toString("hex")}`;
}

/**
 * Verify a plain-text password against a stored hash using constant-time comparison.
 */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const storedHashHex = parts[3];
    const derived = pbkdf2Sync(password, salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST);
    const storedBuf = Buffer.from(storedHashHex, "hex");
    if (derived.length !== storedBuf.length) return false;
    return timingSafeEqual(derived, storedBuf);
  } catch {
    return false;
  }
}

// ─── Session Management ───────────────────────────────────────────────────────

/**
 * Generate a new session token, store its HMAC-SHA256 hash in DB, return raw token.
 * The raw token is sent to the client in an HTTP-only cookie.
 * Only the hash is stored in the database.
 */
export async function createSession(
  adminId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const rawToken = randomBytes(SESSION_BYTES).toString("hex");
  const tokenHash = hashToken(rawToken);
  const sessionId = `sess_${randomBytes(8).toString("hex")}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  await withTransaction(async (db) => {
    await db.prepare("DELETE FROM admin_sessions WHERE admin_id = ? AND expires_at < ?").run(
      adminId,
      now.toISOString()
    );
    await db.prepare(`
    INSERT INTO admin_sessions (id, admin_id, token_hash, expires_at, created_at, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    adminId,
    tokenHash,
    expiresAt.toISOString(),
    now.toISOString(),
    ipAddress || null,
    userAgent || null
  );
  });

  return rawToken;
}

/**
 * Validate a session token from request cookie.
 * Returns the admin user if the session is valid, null otherwise.
 */
export async function validateSession(req: NextRequest): Promise<DbAdminUser | null> {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token || token.length < 10) return null;

  const tokenHash = hashToken(token);
  const db = getDb();

  const session = await db.prepare(`
      SELECT s.*, u.id as uid, u.email, u.name, u.password_hash, u.role, u.is_active, u.created_at as ucreated, u.updated_at as uupdated
      FROM admin_sessions s
      JOIN admin_users u ON u.id = s.admin_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1
    `).get<{
    uid: string;
    email: string;
    name: string;
    password_hash: string;
    role: string;
    is_active: number;
    ucreated: string;
    uupdated: string;
  }>(tokenHash, new Date().toISOString());

  if (!session) return null;

  return {
    id: session.uid,
    email: session.email,
    name: session.name,
    password_hash: session.password_hash,
    role: session.role,
    is_active: session.is_active,
    created_at: session.ucreated,
    updated_at: session.uupdated,
  };
}

/**
 * Invalidate a specific session (logout).
 */
export async function revokeSession(token: string): Promise<void> {
  const db = getDb();
  const tokenHash = hashToken(token);
  await db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(tokenHash);
}

/**
 * Get admin user by email (for login).
 */
export async function getAdminByEmail(email: string): Promise<DbAdminUser | null> {
  const db = getDb();
  return (await db.prepare("SELECT * FROM admin_users WHERE email = ? AND is_active = 1").get<DbAdminUser>(
    email.toLowerCase().trim()
  )) ?? null;
}

/**
 * Create an admin user (called from server-side setup script only).
 */
export async function createAdminUser(
  email: string,
  name: string,
  password: string,
  role = "admin"
): Promise<{ success: boolean; error?: string }> {
  if (password.length < 12) {
    return { success: false, error: "Password must be at least 12 characters." };
  }

  const id = `adm_${randomBytes(8).toString("hex")}`;
  const now = new Date().toISOString();
  const passwordHash = hashPassword(password);
  const result = await getDb().prepare(`
    INSERT INTO admin_users (id, email, name, password_hash, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `).get<{ id: string }>(
    id,
    email.toLowerCase().trim(),
    name,
    passwordHash,
    role,
    now,
    now
  );

  return result
    ? { success: true }
    : { success: false, error: "Admin account with this email already exists." };
}

// ─── Cookie Helpers ────────────────────────────────────────────────────────────

export function getSessionCookieOptions(maxAgeSeconds?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: maxAgeSeconds ?? SESSION_TTL_HOURS * 60 * 60,
  };
}

// ─── Middleware Guard ─────────────────────────────────────────────────────────

/**
 * Returns the authenticated admin or null.
 * Use in Route Handlers for /api/admin/* endpoints.
 */
export function requireAdminAuth(req: NextRequest): Promise<DbAdminUser | null> {
  return validateSession(req);
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function hashToken(rawToken: string): string {
  // Use HMAC-SHA256 with a server secret so stored hashes can't be used
  // even if the DB is compromised (token ≠ hash, and hash uses server secret)
  const secret = process.env.ADMIN_SESSION_SECRET || "rnl_dev_session_secret_change_in_production";
  return createHmac("sha256", secret).update(rawToken).digest("hex");
}
