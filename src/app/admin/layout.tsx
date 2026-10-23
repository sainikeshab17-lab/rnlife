import React from "react";
import { AdminSessionProvider } from "@/components/layout/AdminSessionProvider";

export default function AdminRouteLayout({ children }: { children: React.ReactNode }) {
  return <AdminSessionProvider>{children}</AdminSessionProvider>;
}
