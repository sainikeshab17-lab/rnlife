import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { databaseTest } from "./postgres-test-support.mjs";
import { getDb, withTransaction } from "../src/lib/db/index.ts";
import {
  claimAdminLoginAttempt,
  getAdminLoginProxyHeaders,
  getAdminLoginRateLimitDiagnostic,
  getAdminLoginRateLimitConfig,
  getTrustedAdminLoginClientIp,
  resolveTrustedAdminLoginClientIp,
} from "../src/lib/auth/admin-login-rate-limit.ts";

const TEST_SECRET = "admin-login-rate-limit-test-secret-value";

class MemoryRateLimitDatabase {
  buckets = new Map();

  prepare(sql) {
    return {
      get: async (...params) => {
        assert.match(sql, /INSERT INTO admin_login_rate_limits/);
        const [hash, windowMinutes, , , limit] = params;
        const now = Date.now();
        let bucket = this.buckets.get(hash);
        if (!bucket) {
          bucket = { startedAt: now, attempts: 1, blockedUntil: null };
          this.buckets.set(hash, bucket);
        } else if (bucket.blockedUntil > now) {
          // A blocked bucket remains fixed until its cooldown expires.
        } else if (bucket.startedAt <= now - windowMinutes * 60_000) {
          bucket.startedAt = now;
          bucket.attempts = 1;
          bucket.blockedUntil = null;
        } else {
          bucket.attempts += 1;
          if (bucket.attempts >= limit) bucket.blockedUntil = now + windowMinutes * 60_000;
        }
        return {
          blocked: bucket.blockedUntil > now,
          retry_after_seconds: bucket.blockedUntil > now
            ? Math.ceil((bucket.blockedUntil - now) / 1000)
            : 0,
        };
      },
      run: async (...params) => {
        if (sql.includes("DELETE FROM admin_login_rate_limits")) return { rowCount: 0 };
        assert.match(sql, /UPDATE admin_login_rate_limits/);
        const [hash] = params;
        const bucket = this.buckets.get(hash);
        if (bucket && sql.includes("SET attempt_count = 0")) {
          bucket.attempts = 0;
          bucket.blockedUntil = null;
        } else if (bucket) {
          bucket.attempts = Math.max(0, bucket.attempts - 1);
        }
        return { rowCount: bucket ? 1 : 0 };
      },
    };
  }
}

function memoryDependencies(database = new MemoryRateLimitDatabase()) {
  return {
    database,
    dependencies: {
      secret: TEST_SECRET,
      transaction: async (callback) => callback(database),
    },
  };
}

describe("admin login rate limiting", () => {
  test("uses a modest per-account brute-force limit and configurable higher shared-IP allowance", () => {
    assert.deepEqual(getAdminLoginRateLimitConfig({}), {
      windowMinutes: 15, emailAttemptLimit: 10, ipAttemptLimit: 300,
    });
    assert.deepEqual(getAdminLoginRateLimitConfig({
      ADMIN_LOGIN_RATE_LIMIT_WINDOW_MINUTES: "20",
      ADMIN_LOGIN_EMAIL_ATTEMPT_LIMIT: "8",
      ADMIN_LOGIN_IP_ATTEMPT_LIMIT: "600",
    }), { windowMinutes: 20, emailAttemptLimit: 8, ipAttemptLimit: 600 });
    assert.equal(getAdminLoginRateLimitConfig({ ADMIN_LOGIN_IP_ATTEMPT_LIMIT: "999999" }).ipAttemptLimit, 300);
  });

  test("uses only a configured, single-IP ingress header and rejects spoofable fallbacks", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.7",
      "x-real-ip": "198.51.100.8",
      "x-edge-client-ip": "2001:db8::1",
    });

    assert.equal(getTrustedAdminLoginClientIp(headers, "x-edge-client-ip", "production"), "2001:db8::1");
    assert.deepEqual(resolveTrustedAdminLoginClientIp(headers, undefined, "production", "0"), { clientIp: null, reason: "ip_unavailable" });
    assert.deepEqual(resolveTrustedAdminLoginClientIp(headers, undefined, "production", "1"), { clientIp: null, reason: "header_value_invalid" });
    assert.deepEqual(resolveTrustedAdminLoginClientIp(headers, "x-forwarded-for", "production"), { clientIp: null, reason: "header_invalid" });
    assert.deepEqual(resolveTrustedAdminLoginClientIp(headers, "x-real-ip", "production"), { clientIp: null, reason: "header_invalid" });
    assert.deepEqual(resolveTrustedAdminLoginClientIp(new Headers({ "x-edge-client-ip": "198.51.100.7, 10.0.0.1" }), "x-edge-client-ip", "production"), { clientIp: null, reason: "header_value_invalid" });
    assert.deepEqual(resolveTrustedAdminLoginClientIp(new Headers({ "x-edge-client-ip": "not-an-ip" }), "x-edge-client-ip", "production"), { clientIp: null, reason: "header_value_invalid" });
    assert.deepEqual(resolveTrustedAdminLoginClientIp(headers, "forwarded", "production"), { clientIp: null, reason: "header_invalid" });
    assert.deepEqual(resolveTrustedAdminLoginClientIp({ get: () => " 198.51.100.7" }, "x-edge-client-ip", "production"), { clientIp: null, reason: "header_value_invalid" });
  });

  test("uses Vercel's platform-overwritten IP header only on Vercel and ignores spoofed alternatives", () => {
    const vercelHeaders = new Headers({
      "x-vercel-forwarded-for": "198.51.100.25",
      "x-forwarded-for": "203.0.113.9",
      "x-real-ip": "203.0.113.10",
      "x-client-ip": "203.0.113.11",
    });
    assert.deepEqual(resolveTrustedAdminLoginClientIp(vercelHeaders, undefined, "production", "1"), {
      clientIp: "198.51.100.25", source: "vercel_platform",
    });
    assert.deepEqual(resolveTrustedAdminLoginClientIp(vercelHeaders, undefined, "production", undefined), {
      clientIp: null, reason: "ip_unavailable",
    });
    assert.deepEqual(resolveTrustedAdminLoginClientIp(new Headers({ "x-vercel-forwarded-for": "198.51.100.25, 10.0.0.1" }), undefined, "production", "1"), {
      clientIp: null, reason: "header_value_invalid",
    });
  });

  test("local development proxy overwrites browser headers with a loopback bucket and production ignores it", () => {
    const hostileHeaders = new Headers({
      "x-rightnowlife-dev-client-ip": "203.0.113.99",
      "x-forwarded-for": "203.0.113.99",
    });
    const developmentHeaders = getAdminLoginProxyHeaders(hostileHeaders, "/api/admin/login", "development", "localhost");
    assert.equal(developmentHeaders.get("x-rightnowlife-dev-client-ip"), "127.0.0.1");
    assert.deepEqual(resolveTrustedAdminLoginClientIp(developmentHeaders, "", "development"), {
      clientIp: "127.0.0.1", source: "development_proxy",
    });

    const productionHeaders = getAdminLoginProxyHeaders(hostileHeaders, "/api/admin/login", "production", "localhost");
    assert.deepEqual(resolveTrustedAdminLoginClientIp(productionHeaders, undefined, "production"), {
      clientIp: null, reason: "ip_unavailable",
    });
    assert.equal(getTrustedAdminLoginClientIp(developmentHeaders, undefined, "production"), null);
  });

  test("development proxy injects no IP on unrelated paths and missing injection fails closed", () => {
    const headers = getAdminLoginProxyHeaders(
      new Headers({ "x-rightnowlife-dev-client-ip": "not-an-ip" }),
      "/api/orders",
      "development",
      "localhost",
    );
    assert.equal(headers.get("x-rightnowlife-dev-client-ip"), "not-an-ip");
    assert.deepEqual(resolveTrustedAdminLoginClientIp(headers, "", "development"), {
      clientIp: null, reason: "development_proxy_missing",
    });
  });

  test("development proxy does not inject the local address for a non-loopback host", () => {
    const headers = getAdminLoginProxyHeaders(new Headers(), "/api/admin/login", "development", "dev.example.test");
    assert.equal(headers.has("x-rightnowlife-dev-client-ip"), false);
    assert.deepEqual(resolveTrustedAdminLoginClientIp(headers, "", "development"), {
      clientIp: null, reason: "development_proxy_missing",
    });
  });

  test("blocks repeated failed attempts across normalized account identities and leaves other accounts available", async () => {
    const { dependencies, database } = memoryDependencies();
    const attempts = [];
    for (let index = 0; index < 9; index += 1) {
      attempts.push(await claimAdminLoginAttempt("Admin@Example.test", "198.51.100.10", dependencies));
    }
    assert.ok(attempts.every((attempt) => attempt.allowed));

    const blocked = await claimAdminLoginAttempt("admin@example.test", "198.51.100.10", dependencies);
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) assert.ok(blocked.retryAfterSeconds > 0);

    const otherAccount = await claimAdminLoginAttempt("other@example.test", "198.51.100.10", dependencies);
    assert.equal(otherAccount.allowed, true);
    assert.ok([...database.buckets.keys()].every((key) => /^[a-f0-9]{64}$/.test(key)));
  });

  test("account attempts remain rate limited with no trusted IP and normalized emails cannot be varied", async () => {
    const { dependencies, database } = memoryDependencies();
    for (let index = 0; index < 9; index += 1) {
      assert.equal((await claimAdminLoginAttempt("Admin@Example.test", null, dependencies)).allowed, true);
    }
    assert.equal((await claimAdminLoginAttempt("  admin@example.test  ", null, dependencies)).allowed, false);
    assert.equal(database.buckets.size, 1);
  });

  test("a trusted Vercel IP contributes its own shared rate-limit bucket", async () => {
    const { dependencies, database } = memoryDependencies();
    const resolved = resolveTrustedAdminLoginClientIp(
      new Headers({ "x-vercel-forwarded-for": "198.51.100.99" }), undefined, "production", "1",
    );
    assert.equal(resolved.clientIp, "198.51.100.99");
    const limitedDependencies = { ...dependencies, limits: { emailAttemptLimit: 50, ipAttemptLimit: 2, windowMinutes: 15 } };
    assert.equal((await claimAdminLoginAttempt("first@example.test", resolved.clientIp, limitedDependencies)).allowed, true);
    assert.equal((await claimAdminLoginAttempt("second@example.test", resolved.clientIp, limitedDependencies)).allowed, false);
    assert.equal(database.buckets.size, 2);
  });

  test("missing email requests still consume a bounded account identity bucket without a client IP", async () => {
    const { dependencies, database } = memoryDependencies();
    for (let index = 0; index < 9; index += 1) {
      assert.equal((await claimAdminLoginAttempt(null, null, dependencies)).allowed, true);
    }
    assert.equal((await claimAdminLoginAttempt(null, null, dependencies)).allowed, false);
    assert.equal(database.buckets.size, 1);
  });

  test("configured high-volume shared IP allowance protects legitimate admin logins while accounts stay throttled", async () => {
    const { dependencies } = memoryDependencies();
    for (let index = 0; index < 299; index += 1) {
      const attempt = await claimAdminLoginAttempt(`admin-${index}@example.test`, "198.51.100.88", dependencies);
      assert.equal(attempt.allowed, true);
    }
    const ipLimit = await claimAdminLoginAttempt("admin-299@example.test", "198.51.100.88", dependencies);
    assert.equal(ipLimit.allowed, false);
  });

  test("successful login releases only its reserved slots", async () => {
    const { dependencies, database } = memoryDependencies();
    const attempt = await claimAdminLoginAttempt("valid@example.test", "198.51.100.20", dependencies);
    assert.equal(attempt.allowed, true);
    if (attempt.allowed) await attempt.complete();
    assert.ok([...database.buckets.values()].every((bucket) => bucket.attempts === 0));
  });

  test("expired blocked buckets reset at the next claim", async () => {
    const { dependencies, database } = memoryDependencies();
    for (let index = 0; index < 10; index += 1) {
      await claimAdminLoginAttempt("expiry@example.test", "198.51.100.21", dependencies);
    }
    const emailHash = createHmac("sha256", TEST_SECRET)
      .update("rightnowlife:admin-login:v1:email:expiry@example.test")
      .digest("hex");
    const blockedBucket = database.buckets.get(emailHash);
    assert.ok(blockedBucket.blockedUntil > Date.now());
    blockedBucket.startedAt = Date.now() - 16 * 60_000;
    blockedBucket.blockedUntil = Date.now() - 1;

    const afterWindow = await claimAdminLoginAttempt("expiry@example.test", "198.51.100.21", dependencies);
    assert.equal(afterWindow.allowed, true);
    assert.equal(blockedBucket.attempts, 1);
    assert.equal(blockedBucket.blockedUntil, null);
  });

  test("missing limiter configuration and database failures reject instead of bypassing the limit", async () => {
    await assert.rejects(
      claimAdminLoginAttempt("admin@example.test", "198.51.100.30", {
        secret: "short",
        transaction: async (callback) => callback(new MemoryRateLimitDatabase()),
      }),
      (error) => /ADMIN_SESSION_SECRET/.test(getAdminLoginRateLimitDiagnostic(error)),
    );
    await assert.rejects(
      claimAdminLoginAttempt("admin@example.test", "198.51.100.30", {
        secret: TEST_SECRET,
        transaction: async () => { throw new Error("database unavailable"); },
      }),
      (error) => /PostgreSQL rate-limit storage is unavailable/.test(getAdminLoginRateLimitDiagnostic(error)),
    );
    const missingTable = Object.assign(new Error("relation does not exist"), { code: "42P01" });
    await assert.rejects(claimAdminLoginAttempt("admin@example.test", "198.51.100.30", {
      secret: TEST_SECRET,
      transaction: async () => { throw missingTable; },
    }), (error) => /20261024150000_admin_login_rate_limits\.sql/.test(getAdminLoginRateLimitDiagnostic(error)));
    const missingDatabaseUrl = new Error("DATABASE_URL is required for the PostgreSQL runtime.");
    await assert.rejects(claimAdminLoginAttempt("admin@example.test", "198.51.100.30", {
      secret: TEST_SECRET,
      transaction: async () => { throw missingDatabaseUrl; },
    }), (error) => /DATABASE_URL is not configured/.test(getAdminLoginRateLimitDiagnostic(error)));
  });

  test("admin login requires the limiter before account lookup and never trusts forwarded headers", async () => {
    const source = await readFile("src/services/admin-login-route.ts", "utf8");
    assert.ok(source.indexOf("const ipResolution = deps.resolveClientIp") < source.indexOf("attempt = await deps.claimAttempt"));
    assert.ok(source.indexOf("attempt = await deps.claimAttempt") < source.indexOf("admin = await deps.getAdminByEmail(email)"));
    assert.match(source, /getAdminLoginRateLimitDiagnostic/);
    assert.doesNotMatch(source, /req\.headers\.get\(["']x-forwarded-for|req\.headers\.get\(["']x-real-ip/i);
    assert.match(source, /status: 429/);
    assert.match(source, /status: 503/);
  });

  test("authenticated product and inventory admin routes rely on session authorization, not login throttling", async () => {
    const products = await readFile("src/app/api/admin/products/route.ts", "utf8");
    const inventory = await readFile("src/app/api/admin/inventory/route.ts", "utf8");
    assert.match(products, /requireAdminAuth/);
    assert.match(inventory, /requireAdminAuth/);
    assert.doesNotMatch(products, /claimAdminLoginAttempt|status:\s*429/);
    assert.doesNotMatch(inventory, /claimAdminLoginAttempt|status:\s*429/);
  });

  test("Next proxy skips unnecessary Supabase Auth claims refresh for custom admin routes", async () => {
    const proxy = await readFile("src/proxy.ts", "utf8");
    const limiter = await readFile("src/lib/auth/admin-login-rate-limit.ts", "utf8");
    assert.match(proxy, /usesCustomAdminSession[\s\S]*if \(usesCustomAdminSession\) return response/);
    assert.match(limiter, /pathname === "\/api\/admin\/login"/);
    assert.match(proxy, /each protected handler still authorizes[\s\S]*the admin session itself/i);
  });

  databaseTest("PostgreSQL serializes concurrent claims and persists throttling across connections", async () => {
    // The databaseTest wrapper enforces the approved loopback + test-name gate
    // before this callback can touch DATABASE_URL.
    const db = getDb();
    const uniqueEmail = `limit-${randomUUID()}@example.test`;
    const clientIp = "198.51.100.222";
    const emailHash = createHmac("sha256", TEST_SECRET)
      .update(`rightnowlife:admin-login:v1:email:${uniqueEmail}`)
      .digest("hex");
    const ipHash = createHmac("sha256", TEST_SECRET)
      .update(`rightnowlife:admin-login:v1:ip:${clientIp}`)
      .digest("hex");

    try {
      const claims = await Promise.all(Array.from({ length: 12 }, () =>
        claimAdminLoginAttempt(uniqueEmail, clientIp, {
          secret: TEST_SECRET,
          transaction: withTransaction,
        }),
      ));
      assert.equal(claims.filter((claim) => claim.allowed).length, 9);
      assert.equal(claims.filter((claim) => !claim.allowed).length, 3);

      await Promise.all(claims.filter((claim) => claim.allowed).map((claim) => claim.complete()));
      const emailRemaining = await db.prepare("SELECT attempt_count FROM admin_login_rate_limits WHERE bucket_hash = ?")
        .get(emailHash);
      const ipRemaining = await db.prepare("SELECT attempt_count FROM admin_login_rate_limits WHERE bucket_hash = ?")
        .get(ipHash);
      assert.equal(Number(emailRemaining?.attempt_count ?? 0), 0);
      assert.equal(Number(ipRemaining?.attempt_count ?? 0), 3);
    } finally {
      await db.prepare("DELETE FROM admin_login_rate_limits WHERE bucket_hash IN (?, ?)").run(emailHash, ipHash);
    }
  });
});
