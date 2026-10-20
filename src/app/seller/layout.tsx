
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProtectedSellerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/seller-login?next=/seller");
  }

  // This role must be assigned securely on the server,
  // not by a browser form.
  const role = user.app_metadata?.role;

  if (role !== "seller") {
    if (role === "admin") {
      redirect("/admin");
    }

    redirect("/account");
  }

  return <>{children}</>;
}
