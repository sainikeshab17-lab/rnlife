export interface AdminRouteUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export type AdminSessionResponse =
  | { status: "authenticated"; admin: AdminRouteUser }
  | { status: "redirect" }
  | { status: "unavailable" };

export function getAdminRouteView(
  pathname: string,
  sessionPath: string | null,
  sessionStatus: "checking" | "authenticated" | "unavailable",
) {
  if (pathname === "/admin/login") return "login" as const;
  if (sessionPath !== pathname) return "checking" as const;
  if (sessionStatus === "authenticated") return "content" as const;
  if (sessionStatus === "unavailable") return "retry" as const;
  return "checking" as const;
}

export function resolveAdminSessionResponse(statusCode: number, payload: unknown): AdminSessionResponse {
  if (statusCode === 401) return { status: "redirect" };

  const admin = payload && typeof payload === "object"
    ? (payload as { admin?: unknown }).admin
    : null;
  if (statusCode >= 200 && statusCode < 300 && admin && typeof admin === "object") {
    const candidate = admin as Partial<AdminRouteUser>;
    if ([candidate.id, candidate.email, candidate.name, candidate.role].every((value) => typeof value === "string")) {
      return { status: "authenticated", admin: candidate as AdminRouteUser };
    }
  }

  return { status: "unavailable" };
}
