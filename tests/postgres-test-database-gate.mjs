const REQUIRED_APPROVALS = [
  "TEST_DATABASE_IS_NON_PRODUCTION",
  "TEST_DATABASE_SCHEMA_READY",
];

function isApprovedLoopback(hostname) {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname.toLowerCase());
}

function databaseNameHasTestMarker(databaseName) {
  const tokens = databaseName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.includes("test") || tokens.includes("testing");
}

function databaseNameIsProductionLike(databaseName) {
  const tokens = databaseName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.some(token => ["prod", "production", "live"].includes(token));
}

export function validateTestDatabaseConfig(env) {
  const url = env.TEST_DATABASE_URL;
  const configured = Boolean(url || env.TEST_DATABASE_IS_NON_PRODUCTION || env.TEST_DATABASE_SCHEMA_READY);
  if (!configured) return { approved: false, url: null, reason: "not_configured" };

  if (!url || REQUIRED_APPROVALS.some(name => env[name] !== "1")) {
    throw new Error("PostgreSQL tests require TEST_DATABASE_URL and both explicit test safety approvals.");
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("TEST_DATABASE_URL is invalid.");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("PostgreSQL tests require a PostgreSQL URL.");
  }
  // Reject URL options that could override the apparent loopback target.
  if (parsed.search || parsed.hash || !/^\/[a-z0-9_.-]+$/i.test(parsed.pathname)) {
    throw new Error("PostgreSQL test URL must name one database and contain no query or fragment options.");
  }
  if (!isApprovedLoopback(parsed.hostname)) {
    throw new Error("PostgreSQL tests permit only an approved loopback test host.");
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (databaseNameIsProductionLike(databaseName) || !databaseNameHasTestMarker(databaseName)) {
    throw new Error("PostgreSQL test database name must contain a standalone test/testing token and must not be production-like.");
  }

  return { approved: true, url, reason: null };
}
