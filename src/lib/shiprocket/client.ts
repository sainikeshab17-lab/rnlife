import "server-only";

const API = "https://apiv2.shiprocket.in/v1/external";
type TokenCache = { token: string; expiresAt: number };
const cacheKey = "rightnowlifeShiprocketToken";
type TokenGlobal = typeof globalThis & { [cacheKey]?: TokenCache };

export class ShiprocketError extends Error {
  constructor(message: string, readonly status?: number, readonly ambiguous = false) {
    super(message);
    this.name = "ShiprocketError";
  }
}

function credentials() {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  if (!email || !password) throw new ShiprocketError("Shiprocket credentials are not configured.");
  return { email, password };
}

async function login(): Promise<string> {
  const { email, password } = credentials();
  const response = await fetch(`${API}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }), cache: "no-store", signal: AbortSignal.timeout(12_000),
  }).catch(() => { throw new ShiprocketError("Shiprocket authentication is temporarily unavailable."); });
  const body = await response.json().catch(() => ({})) as { token?: unknown; expires_in?: unknown };
  if (!response.ok || typeof body.token !== "string") throw new ShiprocketError("Shiprocket authentication failed.", response.status);
  // Shiprocket documents a ten-day validity. Expire locally early to avoid edge-of-expiry calls.
  const expiresAt = Date.now() + Math.min(Number(body.expires_in) || 10 * 24 * 60 * 60, 10 * 24 * 60 * 60) * 1000 - 5 * 60 * 1000;
  (globalThis as TokenGlobal)[cacheKey] = { token: body.token, expiresAt };
  return body.token;
}

async function token(): Promise<string> {
  const cached = (globalThis as TokenGlobal)[cacheKey];
  return cached && cached.expiresAt > Date.now() ? cached.token : login();
}

export async function shiprocketRequest<T>(path: string, method: "GET" | "POST", body?: unknown, retryAuth = true): Promise<T> {
  const bearer = await token();
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ShiprocketError("Shiprocket request outcome is unknown. Reconcile the order before retrying.", undefined, true);
  }
  if (response.status === 401 && retryAuth) {
    delete (globalThis as TokenGlobal)[cacheKey];
    return shiprocketRequest<T>(path, method, body, false);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new ShiprocketError(`Shiprocket request failed (${response.status}).`, response.status, response.status >= 500);
  return result as T;
}

export function shiprocketEnabled() {
  return process.env.SHIPROCKET_ENABLED === "true";
}
