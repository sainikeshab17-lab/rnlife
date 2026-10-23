"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getAdminRouteView, resolveAdminSessionResponse } from "@/lib/auth/admin-route-gate";

import type { AdminRouteUser } from "@/lib/auth/admin-route-gate";
export type AdminSessionUser = AdminRouteUser;

type SessionState =
  | { status: "checking"; admin: null; error: null; pathname: string | null }
  | { status: "authenticated"; admin: AdminSessionUser; error: null; pathname: string }
  | { status: "unavailable"; admin: null; error: string; pathname: string };

interface AdminSessionContextValue {
  admin: AdminSessionUser;
}

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<SessionState>({ status: "checking", admin: null, error: null, pathname: null });
  const sessionCheckId = useRef(0);

  const verifySession = useCallback(async (targetPath: string) => {
    const checkId = ++sessionCheckId.current;
    setState({ status: "checking", admin: null, error: null, pathname: targetPath });
    try {
      const response = await fetch("/api/admin/me", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload: unknown = await response.json().catch(() => null);
      if (checkId !== sessionCheckId.current) return;
      const result = resolveAdminSessionResponse(response.status, payload);
      if (result.status === "redirect") {
        router.replace("/admin/login");
        return;
      }
      if (result.status === "authenticated") {
        setState({ status: "authenticated", admin: result.admin, error: null, pathname: targetPath });
        return;
      }
      setState({ status: "unavailable", admin: null, error: "Administrator session could not be verified. Retry in a moment.", pathname: targetPath });
    } catch {
      if (checkId === sessionCheckId.current) {
        setState({ status: "unavailable", admin: null, error: "Administrator session could not be verified. Check your connection and retry.", pathname: targetPath });
      }
    }
  }, [router]);

  useEffect(() => {
    if (pathname === "/admin/login") {
      sessionCheckId.current += 1;
      setState({ status: "checking", admin: null, error: null, pathname });
      return;
    }
    void verifySession(pathname);
  }, [pathname, verifySession]);

  const contextValue = useMemo(() => state.status === "authenticated" ? { admin: state.admin } : null, [state]);
  const routeView = getAdminRouteView(pathname, state.pathname, state.status);

  // The login page must remain reachable when a session is missing or expired.
  if (routeView === "login") return <>{children}</>;

  if (routeView === "retry") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F6F8FB] p-6 text-center">
        <p className="text-sm text-neutral-700">{state.error}</p>
        <button type="button" onClick={() => void verifySession(pathname)} className="bg-black px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">
          Retry session check
        </button>
      </main>
    );
  }

  return routeView === "content" && contextValue ? (
    <AdminSessionContext.Provider value={contextValue}>{children}</AdminSessionContext.Provider>
  ) : (
    <main className="min-h-screen flex items-center justify-center bg-[#F6F8FB]">
      <div className="text-center">
        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-neutral-400" />
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Verifying Administrator Session...</p>
      </div>
    </main>
  );
}

export function useAdminSession(): AdminSessionContextValue {
  const session = useContext(AdminSessionContext);
  if (!session) throw new Error("useAdminSession must be used inside an authenticated admin route.");
  return session;
}
